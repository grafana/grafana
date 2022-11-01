/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import { CheckboxField, Table, logger } from '@percona/platform-core';
import React, { useCallback, useEffect, useState } from 'react';
import { Form } from 'react-final-form';

import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, Modal } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { InventoryDataService, Model } from 'app/percona/inventory/Inventory.tools';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { SelectedTableRows } from 'app/percona/shared/components/Elements/Table';
import { FormElement } from 'app/percona/shared/components/Form';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { filterFulfilled, processPromiseResults } from 'app/percona/shared/helpers/promises';

import { appEvents } from '../../../core/app_events';
import { GET_NODES_CANCEL_TOKEN, NODES_COLUMNS } from '../Inventory.constants';
import { InventoryService } from '../Inventory.service';
import { NodesList } from '../Inventory.types';

import { styles } from './Tabs.styles';

interface Node {
  node_id: string;
  node_name: string;
  address: string;
  [key: string]: string;
}

export const NodesTab = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Model[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelectedRows] = useState<any[]>([]);
  const navModel = usePerconaNavModel('inventory-nodes');
  const [generateToken] = useCancelToken();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result: NodesList = await InventoryService.getNodes(generateToken(GET_NODES_CANCEL_TOKEN));

      setData(InventoryDataService.getNodeModel(result));
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

  const removeNodes = useCallback(
    async (nodes: Array<SelectedTableRows<Node>>, forceMode: boolean) => {
      try {
        setLoading(true);
        // eslint-disable-next-line max-len
        const requests = nodes.map((node) =>
          InventoryService.removeNode({ node_id: node.original.node_id, force: forceMode })
        );

        const results = await processPromiseResults(requests);
        const successfullyDeleted = results.filter(filterFulfilled).length;

        appEvents.emit(AppEvents.alertSuccess, [
          `${successfullyDeleted} of ${nodes.length} nodes successfully deleted`,
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

  const proceed = useCallback(
    async (values: Record<any, any>) => {
      await removeNodes(selected, values.force);
      setModalVisible(false);
    },
    [removeNodes, selected]
  );

  const handleSelectionChange = useCallback((rows: any[]) => {
    setSelectedRows(rows);
  }, []);

  return (
    <OldPage navModel={navModel}>
      <OldPage.Contents>
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
                onSubmit={proceed}
                render={({ handleSubmit }) => (
                  <form onSubmit={handleSubmit}>
                    <>
                      <h4 className={styles.confirmationText}>
                        Are you sure that you want to permanently delete {selected.length}{' '}
                        {selected.length === 1 ? 'node' : 'nodes'}?
                      </h4>
                      <FormElement
                        dataTestId="form-field-force"
                        label="Force mode"
                        element={
                          <CheckboxField
                            name="force"
                            label={
                              'Force mode is going to delete all ' + 'agents and services associated with the nodes'
                            }
                          />
                        }
                      />
                      <HorizontalGroup justify="space-between" spacing="md">
                        <Button variant="secondary" size="md" onClick={() => setModalVisible(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" size="md" variant="destructive" className={styles.destructiveButton}>
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
                columns={NODES_COLUMNS}
                data={data}
                totalItems={data.length}
                rowSelection
                onRowSelection={handleSelectionChange}
                showPagination
                pageSize={25}
                emptyMessage="No nodes Available"
                emptyMessageClassName={styles.emptyMessage}
                pendingRequest={loading}
                overlayClassName={styles.overlay}
              />
            </div>
          </div>
        </FeatureLoader>
      </OldPage.Contents>
    </OldPage>
  );
};

export default NodesTab;
