/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { Row } from 'react-table';

import { AppEvents } from '@grafana/data';
import { Badge, Button, HorizontalGroup, Icon, Link, Modal, TagList, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { Agent, FlattenAgent, ServiceAgentStatus } from 'app/percona/inventory/Inventory.types';
import { SelectedTableRows } from 'app/percona/shared/components/Elements/AnotherTableInstance/Table.types';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { FormElement } from 'app/percona/shared/components/Form';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchNodesAction } from 'app/percona/shared/core/reducers/nodes/nodes';
import { fetchServicesAction } from 'app/percona/shared/core/reducers/services';
import { getNodes, getServices } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { logger } from 'app/percona/shared/helpers/logger';
import { filterFulfilled, processPromiseResults } from 'app/percona/shared/helpers/promises';
import { dispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { appEvents } from '../../../core/app_events';
import { GET_AGENTS_CANCEL_TOKEN, GET_NODES_CANCEL_TOKEN, GET_SERVICES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';
import { InventoryService } from '../Inventory.service';

import { beautifyAgentType, getAgentStatusColor, getAgentStatusText, toAgentModel } from './Agents.utils';
import { getTagsFromLabels } from './Services.utils';
import { getStyles } from './Tabs.styles';

export const Agents: FC<GrafanaRouteComponentProps<{ serviceId: string; nodeId: string }>> = ({ match }) => {
  const [agentsLoading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [data, setData] = useState<Agent[]>([]);
  const [selected, setSelectedRows] = useState<any[]>([]);
  const nodeId = match.params.nodeId
    ? match.params.nodeId === 'pmm-server'
      ? 'pmm-server'
      : match.params.nodeId
    : undefined;
  const navModel = usePerconaNavModel(match.params.serviceId ? 'inventory-services' : 'inventory-nodes');
  const [generateToken] = useCancelToken();
  const { isLoading: servicesLoading, services } = useSelector(getServices);
  const { isLoading: nodesLoading, nodes } = useSelector(getNodes);
  const styles = useStyles2(getStyles);

  const service = services.find((s) => s.params.serviceId === match.params.serviceId);
  const node = nodes.find((s) => s.nodeId === nodeId);
  const flattenAgents = useMemo(() => data.map((value) => ({ type: value.type, ...value.params })), [data]);

  const columns = useMemo(
    (): Array<ExtendedColumn<FlattenAgent>> => [
      {
        Header: Messages.agents.columns.status,
        accessor: 'status',
        Cell: ({ value }: { value: ServiceAgentStatus }) => (
          <Badge text={getAgentStatusText(value)} color={getAgentStatusColor(value)} />
        ),
        type: FilterFieldTypes.DROPDOWN,
        options: [
          {
            label: 'Done',
            value: ServiceAgentStatus.DONE,
          },
          {
            label: 'Running',
            value: ServiceAgentStatus.RUNNING,
          },
          {
            label: 'Starting',
            value: ServiceAgentStatus.STARTING,
          },
          {
            label: 'Stopping',
            value: ServiceAgentStatus.STOPPING,
          },
          {
            label: 'Unknown',
            value: ServiceAgentStatus.UNKNOWN,
          },
          {
            label: 'Waiting',
            value: ServiceAgentStatus.WAITING,
          },
        ],
      },
      {
        Header: Messages.agents.columns.agentType,
        accessor: 'type',
        Cell: ({ value }) => <>{beautifyAgentType(value)}</>,
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.agents.columns.agentId,
        accessor: 'agentId',
        type: FilterFieldTypes.TEXT,
      },
      getExpandAndActionsCol(),
    ],
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { agents = [] } = await InventoryService.getAgents(
        match.params.serviceId,
        nodeId,
        generateToken(GET_AGENTS_CANCEL_TOKEN)
      );
      setData(toAgentModel(agents));
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderSelectedSubRow = React.useCallback(
    (row: Row<FlattenAgent>) => {
      const labels = row.original.customLabels || {};
      const labelKeys = Object.keys(labels);

      return (
        <DetailsRow>
          {!!labelKeys.length && (
            <DetailsRow.Contents title={Messages.agents.details.properties} fullRow>
              <TagList colorIndex={9} className={styles.tagList} tags={getTagsFromLabels(labelKeys, labels)} />
            </DetailsRow.Contents>
          )}
        </DetailsRow>
      );
    },
    [styles.tagList]
  );

  const deletionMsg = useMemo(() => Messages.agents.deleteConfirmation(selected.length), [selected]);

  useEffect(() => {
    if (!service && match.params.serviceId) {
      dispatch(fetchServicesAction({ token: generateToken(GET_SERVICES_CANCEL_TOKEN) }));
    } else if (!node && nodeId) {
      dispatch(fetchNodesAction({ token: generateToken(GET_NODES_CANCEL_TOKEN) }));
    } else {
      loadData();
    }
  }, [generateToken, loadData, service, nodeId, match.params.serviceId, node]);

  const removeAgents = useCallback(
    async (agents: Array<SelectedTableRows<FlattenAgent>>, forceMode: boolean) => {
      try {
        setLoading(true);
        // eslint-disable-next-line max-len
        const requests = agents.map((agent) => InventoryService.removeAgent(agent.original.agentId, forceMode));
        const results = await processPromiseResults(requests);

        const successfullyDeleted = results.filter(filterFulfilled).length;

        if (successfullyDeleted > 0) {
          appEvents.emit(AppEvents.alertSuccess, [Messages.agents.agentsDeleted(successfullyDeleted, agents.length)]);
        }
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
      }
      setSelectedRows([]);
      loadData();
    },
    [loadData]
  );

  const handleSelectionChange = useCallback((rows: any[]) => {
    setSelectedRows(rows);
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <FeatureLoader>
          <HorizontalGroup height="auto">
            <Link href={`${service ? '/inventory/services' : '/inventory/nodes'}`}>
              <Icon name="arrow-left" size="lg" />
              <span className={styles.goBack}>
                {service ? Messages.agents.goBackToServices : Messages.agents.goBackToNodes}
              </span>
            </Link>
          </HorizontalGroup>
          {service && !servicesLoading && (
            <h5 className={styles.agentBreadcrumb}>
              <span>{Messages.agents.breadcrumbLeftService(service.params.serviceName)}</span>
              <span>{Messages.agents.breadcrumbRight}</span>
            </h5>
          )}
          {node && !nodesLoading && (
            <h5 className={styles.agentBreadcrumb}>
              <span>{Messages.agents.breadcrumbLeftNode(node.nodeName)}</span>
              <span>{Messages.agents.breadcrumbRight}</span>
            </h5>
          )}
          <HorizontalGroup height={40} justify="flex-end" align="flex-start">
            <Button
              size="md"
              disabled={selected.length === 0}
              onClick={() => {
                setModalVisible((visible) => !visible);
              }}
              icon="trash-alt"
              variant="destructive"
            >
              {Messages.delete}
            </Button>
          </HorizontalGroup>
          <Modal
            title={
              <div className="modal-header-title">
                <span className="p-l-1">Confirm action</span>
              </div>
            }
            isOpen={modalVisible}
            onDismiss={() => setModalVisible(false)}
          >
            <Form
              onSubmit={() => {}}
              render={({ form, handleSubmit }) => (
                <form onSubmit={handleSubmit}>
                  <>
                    <h4 className={styles.confirmationText}>{deletionMsg}</h4>
                    <FormElement
                      dataTestId="form-field-force"
                      label={Messages.forceMode}
                      element={<CheckboxField name="force" label={Messages.agents.forceConfirmation} />}
                    />

                    <HorizontalGroup justify="space-between" spacing="md">
                      <Button variant="secondary" size="md" onClick={() => setModalVisible(false)}>
                        {Messages.cancel}
                      </Button>
                      <Button
                        size="md"
                        onClick={() => {
                          removeAgents(selected, form.getState().values.force);
                          setModalVisible(false);
                        }}
                        variant="destructive"
                      >
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
            data={flattenAgents}
            totalItems={flattenAgents.length}
            rowSelection
            autoResetSelectedRows={false}
            onRowSelection={handleSelectionChange}
            showPagination
            pageSize={25}
            allRowsSelectionMode="page"
            emptyMessage={Messages.agents.emptyTable}
            emptyMessageClassName={styles.emptyMessage}
            pendingRequest={agentsLoading || servicesLoading || nodesLoading}
            overlayClassName={styles.overlay}
            renderExpandedRow={renderSelectedSubRow}
            getRowId={useCallback((row: FlattenAgent) => row.agentId, [])}
            showFilter
          />
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default Agents;
