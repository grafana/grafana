/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { Row } from 'react-table';

import { AppEvents } from '@grafana/data';
import { Badge, Button, HorizontalGroup, Icon, Link, Modal, TagList, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Action } from 'app/percona/dbaas/components/MultipleActions';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { FormElement } from 'app/percona/shared/components/Form';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { RemoveNodeParams } from 'app/percona/shared/core/reducers/nodes';
import { fetchNodesAction, removeNodesAction } from 'app/percona/shared/core/reducers/nodes/nodes';
import { getNodes } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { logger } from 'app/percona/shared/helpers/logger';
import { NodeType } from 'app/percona/shared/services/nodes/Nodes.types';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { appEvents } from '../../../core/app_events';
import { GET_NODES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';
import { FlattenNode, MonitoringStatus, Node } from '../Inventory.types';
import { StatusBadge } from '../components/StatusBadge/StatusBadge';
import { StatusLink } from '../components/StatusLink/StatusLink';

import { getServiceLink, stripNodeId } from './Nodes.utils';
import { getBadgeColorForServiceStatus, getBadgeIconForServiceStatus } from './Services.utils';
import { getStyles } from './Tabs.styles';

export const NodesTab = () => {
  const { isLoading, nodes } = useSelector(getNodes);
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelectedRows] = useState<any[]>([]);
  const [actionItem, setActionItem] = useState<Node | null>(null);
  const navModel = usePerconaNavModel('inventory-nodes');
  const [generateToken] = useCancelToken();
  const styles = useStyles2(getStyles);
  const dispatch = useAppDispatch();

  const getActions = useCallback(
    (row: Row<Node>): Action[] => [
      {
        content: (
          <HorizontalGroup spacing="sm">
            <Icon name="trash-alt" />
            <span className={styles.actionItemTxtSpan}>{Messages.delete}</span>
          </HorizontalGroup>
        ),
        action: () => {
          setActionItem(row.original);
          setModalVisible(true);
        },
      },
    ],
    [styles.actionItemTxtSpan]
  );

  const columns = useMemo(
    (): Array<ExtendedColumn<Node>> => [
      {
        Header: Messages.services.columns.nodeId,
        id: 'nodeId',
        accessor: 'nodeId',
        hidden: true,
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.services.columns.status,
        accessor: 'status',
        Cell: ({ value }: { value: ServiceStatus }) => (
          <Badge
            text={capitalizeText(value)}
            color={getBadgeColorForServiceStatus(value)}
            icon={getBadgeIconForServiceStatus(value)}
          />
        ),
      },
      {
        Header: Messages.nodes.columns.nodeName,
        accessor: 'nodeName',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.nodes.columns.nodeType,
        accessor: 'nodeType',
        type: FilterFieldTypes.DROPDOWN,
        options: [
          {
            label: 'Container',
            value: NodeType.container,
          },
          {
            label: 'Generic',
            value: NodeType.generic,
          },
          {
            label: 'Remote',
            value: NodeType.remote,
          },
          {
            label: 'RemoteAzureDB',
            value: NodeType.remoteAzureDB,
          },
          {
            label: 'RemoteRDS',
            value: NodeType.remoteRDS,
          },
        ],
      },
      {
        Header: Messages.services.columns.monitoring,
        accessor: 'agentsStatus',
        width: '70px',
        Cell: ({ value, row }) => (
          <StatusLink
            type="nodes"
            strippedId={row.original.nodeId === 'pmm-server' ? 'pmm-server' : stripNodeId(row.original.nodeId)}
            agentsStatus={value}
          />
        ),
        type: FilterFieldTypes.RADIO_BUTTON,
        options: [
          {
            label: MonitoringStatus.OK,
            value: MonitoringStatus.OK,
          },
          {
            label: MonitoringStatus.FAILED,
            value: MonitoringStatus.FAILED,
          },
        ],
      },
      {
        Header: Messages.nodes.columns.address,
        accessor: 'address',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.nodes.columns.services,
        accessor: 'services',
        Cell: ({ value, row }) => {
          if (!value || value.length < 1) {
            return <div>{Messages.nodes.noServices}</div>;
          }

          if (value.length === 1) {
            return (
              <Link className={styles.link} href={getServiceLink(value[0].serviceId)}>
                {value[0].serviceName}
              </Link>
            );
          }

          return <div>{Messages.nodes.servicesCount(value.length)}</div>;
        },
      },
      getExpandAndActionsCol(getActions),
    ],
    [styles, getActions]
  );

  const loadData = useCallback(async () => {
    try {
      await dispatch(fetchNodesAction({ token: generateToken(GET_NODES_CANCEL_TOKEN) })).unwrap();
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderSelectedSubRow = React.useCallback(
    (row: Row<Node>) => {
      const labels = row.original.customLabels || {};
      const labelKeys = Object.keys(labels);
      const extraProperties = row.original.properties || {};
      const extraPropertiesKeys = Object.keys(extraProperties);
      const agents = row.original.agents || [];
      return (
        <DetailsRow>
          {!!agents.length && (
            <DetailsRow.Contents title={Messages.services.details.agents}>
              <StatusBadge
                type="nodes"
                strippedId={row.original.nodeId === 'pmm-server' ? 'pmm-server' : stripNodeId(row.original.nodeId)}
                agents={row.original.agents || []}
              />
            </DetailsRow.Contents>
          )}
          <DetailsRow.Contents title={Messages.nodes.details.nodeId}>
            <span>{row.original.nodeId}</span>
          </DetailsRow.Contents>
          {row.original.services && row.original.services.length && (
            <DetailsRow.Contents title={Messages.nodes.details.serviceNames}>
              {row.original.services.map((service) => (
                <div key={service.serviceId}>
                  <Link className={styles.link} href={getServiceLink(service.serviceId)}>
                    {service.serviceName}
                  </Link>
                </div>
              ))}
            </DetailsRow.Contents>
          )}
          {!!labelKeys.length && (
            <DetailsRow.Contents title={Messages.services.details.labels} fullRow>
              <TagList
                colorIndex={9}
                className={styles.tagList}
                tags={labelKeys.map((label) => `${label}=${labels![label]}`)}
              />
            </DetailsRow.Contents>
          )}
          {!!extraPropertiesKeys.length && (
            <DetailsRow.Contents title={Messages.services.details.properties} fullRow>
              <TagList
                colorIndex={9}
                className={styles.tagList}
                tags={extraPropertiesKeys.map((prop) => `${prop}=${extraProperties![prop]}`)}
              />
            </DetailsRow.Contents>
          )}
        </DetailsRow>
      );
    },
    [styles.tagList, styles.link]
  );

  const deletionMsg = useMemo(() => {
    const nodesToDelete = actionItem ? [actionItem] : selected;

    return Messages.nodes.deleteConfirmation(nodesToDelete.length);
  }, [actionItem, selected]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeNodes = useCallback(
    async (forceMode: boolean) => {
      const nodesToDelete = actionItem ? [actionItem] : selected.map((s) => s.original);
      try {
        // eslint-disable-next-line max-len
        const requests = nodesToDelete.map<RemoveNodeParams>((node) => ({
          nodeId: node.nodeId,
          force: forceMode,
        }));

        const successfullyDeleted = await dispatch(removeNodesAction({ nodes: requests })).unwrap();

        if (successfullyDeleted > 0) {
          appEvents.emit(AppEvents.alertSuccess, [
            Messages.nodes.nodesDeleted(successfullyDeleted, nodesToDelete.length),
          ]);
        }
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
      }
      if (actionItem) {
        setActionItem(null);
      } else {
        setSelectedRows([]);
      }
      loadData();
    },
    [actionItem, dispatch, loadData, selected]
  );

  const proceed = useCallback(
    async (values: Record<any, any>) => {
      await removeNodes(values.force);
      setModalVisible(false);
    },
    [removeNodes]
  );

  const handleSelectionChange = useCallback((rows: any[]) => {
    setSelectedRows(rows);
  }, []);

  return (
    <OldPage navModel={navModel}>
      <OldPage.Contents>
        <FeatureLoader>
          <div className={styles.actionPanel}>
            <Button
              size="md"
              disabled={selected.length === 0}
              onClick={() => {
                setModalVisible(!modalVisible);
              }}
              icon="trash-alt"
              variant="destructive"
            >
              {Messages.delete}
            </Button>
          </div>
          <Modal
            title={
              <div className="modal-header-title">
                <span className="p-l-1">{Messages.confirmAction}</span>
              </div>
            }
            isOpen={modalVisible}
            onDismiss={() => setModalVisible(false)}
          >
            <Form
              onSubmit={proceed}
              render={({ handleSubmit }) => (
                <form onSubmit={handleSubmit}>
                  <>
                    <h4 className={styles.confirmationText}>{deletionMsg}</h4>
                    <FormElement
                      dataTestId="form-field-force"
                      label={Messages.forceMode}
                      element={<CheckboxField name="force" label={Messages.nodes.forceConfirmation} />}
                    />
                    <HorizontalGroup justify="space-between" spacing="md">
                      <Button variant="secondary" size="md" onClick={() => setModalVisible(false)}>
                        {Messages.cancel}
                      </Button>
                      <Button type="submit" size="md" variant="destructive">
                        {Messages.proceed}
                      </Button>
                    </HorizontalGroup>
                  </>
                </form>
              )}
            />
          </Modal>
          <Table
            columns={columns}
            data={nodes}
            totalItems={nodes.length}
            rowSelection
            autoResetSelectedRows={false}
            onRowSelection={handleSelectionChange}
            showPagination
            pageSize={25}
            allRowsSelectionMode="page"
            emptyMessage={Messages.nodes.emptyTable}
            pendingRequest={isLoading}
            overlayClassName={styles.overlay}
            renderExpandedRow={renderSelectedSubRow}
            getRowId={useCallback((row: FlattenNode) => row.nodeId, [])}
            showFilter
          />
        </FeatureLoader>
      </OldPage.Contents>
    </OldPage>
  );
};

export default NodesTab;
