import React, { useCallback, useEffect, useState } from 'react';
import { Button, HorizontalGroup, Modal } from '@grafana/ui';
import { CheckboxField, logger } from '@percona/platform-core';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import Page from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Form } from 'react-final-form';
import { Table } from 'app/percona/shared/components/Elements/Table/Table';
import { filterFulfilled, processPromiseResults } from 'app/percona/shared/helpers/promises';
import { InventoryDataService } from 'app/percona/inventory/Inventory.tools';
import { FormElement } from 'app/percona/shared/components/Form';
import { AgentsList } from 'app/percona/inventory/Inventory.types';
import { SelectedTableRows } from 'app/percona/shared/components/Elements/Table/Table.types';
import { InventoryService } from '../Inventory.service';
import { AGENTS_COLUMNS, GET_AGENTS_CANCEL_TOKEN } from '../Inventory.constants';
import { styles } from './Tabs.styles';
import { appEvents } from '../../../core/app_events';
import { AppEvents } from '@grafana/data';

interface Agent {
  agent_id: string;
  [key: string]: string;
}

export const Agents = () => {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [selected, setSelectedRows] = useState([]);
  const navModel = usePerconaNavModel('inventory-agents');
  const [generateToken] = useCancelToken();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result: AgentsList = await InventoryService.getAgents(generateToken(GET_AGENTS_CANCEL_TOKEN));

      setData(InventoryDataService.getAgentModel(result));
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeAgents = useCallback(
    async (agents: Array<SelectedTableRows<Agent>>, forceMode) => {
      try {
        setLoading(true);
        // eslint-disable-next-line max-len
        const requests = agents.map((agent) =>
          InventoryService.removeAgent({ agent_id: agent.original.agent_id, force: forceMode })
        );
        const results = await processPromiseResults(requests);

        const successfullyDeleted = results.filter(filterFulfilled).length;

        appEvents.emit(AppEvents.alertSuccess, [
          `${successfullyDeleted} of ${agents.length} agents successfully deleted`,
        ]);
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

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <FeatureLoader>
          <div className={styles.tableWrapper}>
            <div className={styles.actionPanel}>
              <Button
                size="md"
                disabled={selected.length === 0}
                onClick={() => {
                  setModalVisible(!modalVisible);
                }}
                icon="trash-alt"
                variant="destructive"
                className={styles.destructiveButton}
              >
                Delete
              </Button>
            </div>
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
                      <h4 className={styles.confirmationText}>
                        Are you sure that you want to permanently delete {selected.length}{' '}
                        {selected.length === 1 ? 'agent' : 'agents'}?
                      </h4>
                      <FormElement
                        dataTestId="form-field-force"
                        label="Force mode"
                        element={
                          <CheckboxField name="force" label="Force mode is going to delete all associated agents" />
                        }
                      />

                      <HorizontalGroup justify="space-between" spacing="md">
                        <Button variant="secondary" size="md" onClick={() => setModalVisible(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="md"
                          onClick={() => {
                            removeAgents(selected, form.getState().values.force);
                            setModalVisible(false);
                          }}
                          variant="destructive"
                          className={styles.destructiveButton}
                        >
                          Proceed
                        </Button>
                      </HorizontalGroup>
                    </>
                  </form>
                )}
              />
            </Modal>
            <div className={styles.tableInnerWrapper} data-testid="table-inner-wrapper">
              <Table
                className={styles.table}
                columns={AGENTS_COLUMNS}
                data={data}
                rowSelection
                onRowSelection={(selected) => setSelectedRows(selected)}
                noData={<h1>No agents Available</h1>}
                loading={loading}
              />
            </div>
          </div>
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default Agents;
