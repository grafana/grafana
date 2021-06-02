import React, { useCallback, useEffect, useState } from 'react';
import { Button, HorizontalGroup, Modal } from '@grafana/ui';
import { Form } from 'react-final-form';
import { Table } from 'app/percona/shared/components/Elements/Table/Table';
import { FormElement } from 'app/percona/shared/components/Form';
import { filterFulfilled, processPromiseResults } from 'app/percona/shared/helpers/promises';
import { InventoryDataService } from 'app/percona/inventory/Inventory.tools';
import { SelectedTableRows } from 'app/percona/shared/components/Elements/Table/Table.types';
import { InventoryService } from '../Inventory.service';
import { NodesList } from '../Inventory.types';
import { NODES_COLUMNS } from '../Inventory.constants';
import { styles } from './Tabs.styles';
import { CheckboxField } from '@percona/platform-core';
import { appEvents } from '../../../core/app_events';
import { AppEvents } from '@grafana/data';

interface Node {
  node_id: string;
  node_name: string;
  address: string;
  [key: string]: string;
}

export const NodesTab = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelectedRows] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result: NodesList = await InventoryService.getNodes();

      setData(InventoryDataService.getNodeModel(result));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const removeNodes = useCallback(async (nodes: Array<SelectedTableRows<Node>>, forceMode) => {
    try {
      setLoading(true);
      // eslint-disable-next-line max-len
      const requests = nodes.map(node =>
        InventoryService.removeNode({ node_id: node.original.node_id, force: forceMode })
      );

      const results = await processPromiseResults(requests);
      const successfullyDeleted = results.filter(filterFulfilled).length;

      appEvents.emit(AppEvents.alertSuccess, [`${successfullyDeleted} of ${nodes.length} nodes successfully deleted`]);
    } catch (e) {
      console.error(e);
    } finally {
      setSelectedRows([]);
      loadData();
    }
  }, []);

  return (
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
                  {selected.length === 1 ? 'node' : 'nodes'}?
                </h4>
                <FormElement
                  dataQa="form-field-force"
                  label="Force mode"
                  element={
                    <CheckboxField
                      name="force"
                      label={'Force mode is going to delete all ' + 'agents and services associated with the nodes'}
                    />
                  }
                />
                <HorizontalGroup justify="space-between" spacing="md">
                  <Button variant="secondary" size="md" onClick={() => setModalVisible(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="md"
                    onClick={() => {
                      removeNodes(selected, form.getState().values.force);
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
      <div className={styles.tableInnerWrapper} data-qa="table-inner-wrapper">
        <Table
          className={styles.table}
          columns={NODES_COLUMNS}
          data={data}
          rowSelection
          onRowSelection={selected => setSelectedRows(selected)}
          noData={<h1>No nodes Available</h1>}
          loading={loading}
        />
      </div>
    </div>
  );
};
