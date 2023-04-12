/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import { CheckboxField, Table, logger } from '@percona/platform-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { Column, Row } from 'react-table';

import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, Modal, TagList, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { SelectedTableRows } from 'app/percona/shared/components/Elements/Table';
import { FormElement } from 'app/percona/shared/components/Form';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { RemoveNodeParams } from 'app/percona/shared/core/reducers/nodes';
import { fetchNodesAction, removeNodesAction } from 'app/percona/shared/core/reducers/nodes/nodes';
import { getNodes } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { Node } from 'app/percona/shared/services/nodes/Nodes.types';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { appEvents } from '../../../core/app_events';
import { GET_NODES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';

import { getStyles } from './Tabs.styles';

export const NodesTab = () => {
  const { isLoading, nodes } = useSelector(getNodes);
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelectedRows] = useState<any[]>([]);
  const navModel = usePerconaNavModel('inventory-nodes');
  const [generateToken] = useCancelToken();
  const styles = useStyles2(getStyles);
  const dispatch = useAppDispatch();

  const columns = useMemo(
    (): Array<Column<Node>> => [
      {
        Header: Messages.nodes.columns.nodeName,
        accessor: (row) => row.params.nodeName,
      },
      {
        Header: Messages.nodes.columns.nodeId,
        accessor: (row) => row.params.nodeId,
      },
      {
        Header: Messages.nodes.columns.nodeType,
        accessor: 'type',
      },
      {
        Header: Messages.nodes.columns.address,
        accessor: (row) => row.params.address,
      },
      getExpandAndActionsCol(),
    ],
    []
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
      const labels = row.original.params.customLabels || {};
      const labelKeys = Object.keys(labels);

      return (
        <DetailsRow>
          {!!labelKeys.length && (
            <DetailsRow.Contents title="Labels" fullRow>
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

  const deletionMsg = useMemo(() => Messages.nodes.deleteConfirmation(selected.length), [selected]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeNodes = useCallback(
    async (nodes: Array<SelectedTableRows<Node>>, forceMode: boolean) => {
      try {
        // eslint-disable-next-line max-len
        const requests = nodes.map<RemoveNodeParams>((node) => ({
          nodeId: node.original.params.nodeId,
          force: forceMode,
        }));

        const successfullyDeleted = await dispatch(removeNodesAction({ nodes: requests })).unwrap();

        if (successfullyDeleted > 0) {
          appEvents.emit(AppEvents.alertSuccess, [Messages.nodes.nodesDeleted(successfullyDeleted, nodes.length)]);
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
    [dispatch, loadData]
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
            // @ts-ignore
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
            emptyMessageClassName={styles.emptyMessage}
            pendingRequest={isLoading}
            overlayClassName={styles.overlay}
            renderExpandedRow={renderSelectedSubRow}
            getRowId={useCallback((row: Node) => row.params.nodeId, [])}
          />
        </FeatureLoader>
      </OldPage.Contents>
    </OldPage>
  );
};

export default NodesTab;
