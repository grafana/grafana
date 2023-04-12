/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import { CheckboxField, Table, logger } from '@percona/platform-core';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { Column, Row } from 'react-table';

import { AppEvents } from '@grafana/data';
import { Badge, Button, HorizontalGroup, Icon, Link, Modal, TagList, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { formatServiceId } from 'app/percona/check/components/FailedChecksTab/FailedChecksTab.utils';
import { Agent, ServiceAgentStatus } from 'app/percona/inventory/Inventory.types';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { SelectedTableRows } from 'app/percona/shared/components/Elements/Table/Table.types';
import { FormElement } from 'app/percona/shared/components/Form';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchServicesAction } from 'app/percona/shared/core/reducers/services';
import { getServices } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { filterFulfilled, processPromiseResults } from 'app/percona/shared/helpers/promises';
import { dispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { appEvents } from '../../../core/app_events';
import { GET_AGENTS_CANCEL_TOKEN, GET_SERVICES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';
import { InventoryService } from '../Inventory.service';

import { beautifyAgentType, getAgentStatusColor, toAgentModel } from './Agents.utils';
import { getStyles } from './Tabs.styles';

export const Agents: FC<GrafanaRouteComponentProps<{ id: string }>> = ({ match }) => {
  const [agentsLoading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [data, setData] = useState<Agent[]>([]);
  const [selected, setSelectedRows] = useState<any[]>([]);
  const navModel = usePerconaNavModel('inventory-services');
  const [generateToken] = useCancelToken();
  const { isLoading: servicesLoading, services } = useSelector(getServices);
  const styles = useStyles2(getStyles);
  const serviceId = formatServiceId(match.params.id);
  const service = services.find((s) => s.params.serviceId === serviceId);

  const columns = useMemo(
    (): Array<Column<Agent>> => [
      {
        Header: Messages.agents.columns.status,
        accessor: (row) => row.params.status,
        Cell: ({ value }: { value: ServiceAgentStatus }) => (
          <Badge text={capitalizeText(value)} color={getAgentStatusColor(value)} />
        ),
      },
      {
        Header: Messages.agents.columns.agentType,
        accessor: 'type',
        Cell: ({ value }) => beautifyAgentType(value),
      },
      {
        Header: Messages.agents.columns.agentId,
        accessor: (row) => row.params.agentId,
      },
      getExpandAndActionsCol(),
    ],
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { agents = [] } = await InventoryService.getAgents(serviceId, generateToken(GET_AGENTS_CANCEL_TOKEN));

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
    (row: Row<Agent>) => {
      const labels = row.original.params.customLabels || {};
      const labelKeys = Object.keys(labels);

      return (
        <DetailsRow>
          {!!labelKeys.length && (
            <DetailsRow.Contents title={Messages.agents.details.properties} fullRow>
              <TagList
                colorIndex={9}
                className={styles.tagList}
                tags={labelKeys.map((label) => `${label}=${labels![label]}`)}
              />
            </DetailsRow.Contents>
          )}
        </DetailsRow>
      );
    },
    [styles.tagList]
  );

  const deletionMsg = useMemo(() => Messages.agents.deleteConfirmation(selected.length), [selected]);

  useEffect(() => {
    if (!service) {
      dispatch(fetchServicesAction({ token: generateToken(GET_SERVICES_CANCEL_TOKEN) }));
    } else {
      loadData();
    }
  }, [generateToken, loadData, service]);

  const removeAgents = useCallback(
    async (agents: Array<SelectedTableRows<Agent>>, forceMode) => {
      try {
        setLoading(true);
        // eslint-disable-next-line max-len
        const requests = agents.map((agent) =>
          InventoryService.removeAgent({ agent_id: agent.original.params.agentId, force: forceMode })
        );
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
            <Link href="/inventory/services">
              <Icon name="arrow-left" size="lg" />
              <span className={styles.goBack}>{Messages.agents.goBack}</span>
            </Link>
          </HorizontalGroup>
          {service && !servicesLoading && (
            <h5 className={styles.agentBreadcrumb}>
              <span>{Messages.agents.breadcrumbLeft(service.params.serviceName)}</span>
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
            // @ts-ignore
            columns={columns}
            data={data}
            totalItems={data.length}
            rowSelection
            autoResetSelectedRows={false}
            onRowSelection={handleSelectionChange}
            showPagination
            pageSize={25}
            allRowsSelectionMode="page"
            emptyMessage={Messages.agents.emptyTable}
            emptyMessageClassName={styles.emptyMessage}
            pendingRequest={agentsLoading || servicesLoading}
            overlayClassName={styles.overlay}
            renderExpandedRow={renderSelectedSubRow}
            getRowId={useCallback((row: Agent) => row.params.agentId, [])}
          />
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default Agents;
