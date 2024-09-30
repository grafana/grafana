import { CancelToken } from 'axios';
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Row } from 'react-table';

import { HorizontalGroup, Icon, useStyles2, Badge, BadgeColor, LinkButton, Button } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { DATA_INTERVAL } from 'app/percona/backup/components/BackupInventory/BackupInventory.constants';
import { DetailedDate } from 'app/percona/backup/components/DetailedDate';
import { useRecurringCall } from 'app/percona/backup/hooks/recurringCall.hook';
import { DumpStatus, DumpStatusColor, DumpStatusText, PMMDumpServices } from 'app/percona/pmm-dump/PmmDump.types';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { Action } from 'app/percona/shared/components/Elements/MultipleActions';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { PMM_DUMP_PAGE } from 'app/percona/shared/components/PerconaBootstrapper/PerconaNavigation';
import {
  deletePmmDumpAction,
  downloadPmmDumpAction,
  fetchPmmDumpAction,
  getDumpLogsAction,
} from 'app/percona/shared/core/reducers/pmmDump/pmmDump';
import { getDumps } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { logger } from 'app/percona/shared/helpers/logger';
import { dateDifferenceInWords } from 'app/percona/shared/helpers/utils/timeRange';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { Messages } from './PMMDump.messages';
import { getStyles } from './PmmDump.styles';
import { SendToSupportModal } from './SendToSupportModal';
import { PmmDumpLogsModal } from './components/PmmDumpLogsModal/PmmDumpLogsModal';
export const NEW_BACKUP_URL = '/pmm-dump/new';

export const PMMDump = () => {
  const styles = useStyles2(getStyles);
  const dispatch = useAppDispatch();
  const { dumps, isDownloading, isDeleting } = useSelector(getDumps);
  const [triggerTimeout] = useRecurringCall();
  const [selectedRows, setSelectedRows] = useState<Array<Row<PMMDumpServices>>>([]);
  const [selectedDumpIds, setSelectedDumpIds] = useState<string[]>([]);
  const [selectedDump, setSelectedDump] = useState<PMMDumpServices | null>(null);
  const [isSendToSupportModalOpened, setIsSendToSupportModalOpened] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await dispatch(fetchPmmDumpAction());
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getLogs = useCallback(
    async (startingChunk: number, offset: number, token?: CancelToken | undefined) => {
      const logs = await dispatch(
        getDumpLogsAction({ artifactId: selectedDump?.dumpId || '', startingChunk, offset, token })
      ).unwrap();
      return logs;
    },
    [selectedDump, dispatch]
  );

  useEffect(() => {
    loadData().then(() => triggerTimeout(loadData, DATA_INTERVAL));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  const closeEditModal = (saved = false) => {
    setIsSendToSupportModalOpened(false);
    setSelectedDump(null);
  };

  const getActions = useCallback(
    (row: Row<PMMDumpServices>): Action[] => [
      {
        content: (
          <HorizontalGroup spacing="sm">
            <Icon name="download-alt" />
            <span className={styles.actionItemTxtSpan}>{Messages.dumps.actions.download}</span>
          </HorizontalGroup>
        ),
        action: () => {
          onDownload(row.original);
        },
        disabled: row.original.status !== DumpStatus.DUMP_STATUS_SUCCESS || isDeleting,
      },
      {
        content: (
          <HorizontalGroup spacing="sm">
            <Icon name="arrow-right" />
            <span className={styles.actionItemTxtSpan}>{Messages.dumps.actions.sendToSupport}</span>
          </HorizontalGroup>
        ),
        action: () => {
          setSelectedDumpIds([row.original.dumpId]);
          setIsSendToSupportModalOpened(true);
        },
      },
      {
        content: (
          <HorizontalGroup spacing="sm">
            <Icon name="eye" />
            <span className={styles.actionItemTxtSpan}>{Messages.dumps.actions.viewLogs}</span>
          </HorizontalGroup>
        ),
        action: () => {
          onLogClick(row.original);
        },
      },
      {
        content: (
          <HorizontalGroup spacing="sm">
            <Icon name="trash-alt" />
            <span className={styles.actionItemTxtSpan}>{Messages.dumps.actions.delete}</span>
          </HorizontalGroup>
        ),
        action: () => {
          onDelete(row.original);
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styles.actionItemTxtSpan, isDeleting]
  );

  const onDelete = (value?: PMMDumpServices) => {
    if (value) {
      appEvents.publish(
        new ShowConfirmModalEvent({
          title: Messages.dumps.actions.delete,
          text: Messages.dumps.actions.deleteDumpMessage,
          yesText: Messages.dumps.actions.delete,
          icon: 'trash-alt',
          onConfirm: () => {
            dispatch(deletePmmDumpAction([value.dumpId]));
          },
        })
      );
    } else if (selectedRows.length > 0) {
      appEvents.publish(
        new ShowConfirmModalEvent({
          title: Messages.dumps.actions.delete,
          text: Messages.dumps.actions.deleteMultipleDumpsMessage,
          yesText: Messages.dumps.actions.delete,
          icon: 'trash-alt',
          onConfirm: () => {
            const dumpIds = selectedRows.map((item) => item.original.dumpId);
            dispatch(deletePmmDumpAction(dumpIds));
          },
        })
      );
    }
    loadData();
  };

  const onDownload = (value?: PMMDumpServices) => {
    if (value) {
      dispatch(downloadPmmDumpAction([value.dumpId]));
    } else if (selectedRows.length > 0) {
      const dumpIds = selectedRows.map((item) => item.original.dumpId);
      dispatch(downloadPmmDumpAction(dumpIds));
    }
  };

  const columns = useMemo(
    (): Array<ExtendedColumn<PMMDumpServices>> => [
      {
        Header: Messages.dumps.columns.id,
        id: 'dumpId',
        accessor: 'dumpId',
        hidden: true,
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.dumps.columns.status,
        accessor: 'status',
        Cell: ({ value }: { value: DumpStatus }) => (
          <Badge text={DumpStatusText[value]} color={DumpStatusColor[value as DumpStatus] as BadgeColor} />
        ),
        type: FilterFieldTypes.DROPDOWN,
        options: [
          {
            label: DumpStatusText[DumpStatus.DUMP_STATUS_IN_PROGRESS],
            value: DumpStatus.DUMP_STATUS_IN_PROGRESS,
          },
          {
            label: DumpStatusText[DumpStatus.DUMP_STATUS_INVALID],
            value: DumpStatus.DUMP_STATUS_INVALID,
          },
          {
            label: DumpStatusText[DumpStatus.DUMP_STATUS_ERROR],
            value: DumpStatus.DUMP_STATUS_ERROR,
          },
          {
            label: DumpStatusText[DumpStatus.DUMP_STATUS_SUCCESS],
            value: DumpStatus.DUMP_STATUS_SUCCESS,
          },
        ],
      },
      {
        Header: Messages.dumps.columns.created,
        accessor: 'createdAt',
        type: FilterFieldTypes.TEXT,
        Cell: ({ value }) => <DetailedDate date={new Date(value).getTime()} />,
      },
      {
        Header: Messages.dumps.columns.timeRange,
        accessor: 'timeRange',
        type: FilterFieldTypes.TEXT,
        Cell: ({ value, row }: { row: Row<PMMDumpServices>; value?: string }) => {
          if (value === undefined) {
            return 'N/A';
          } else {
            return dateDifferenceInWords(row.original.endTime, row.original.startTime);
          }
        },
      },
      {
        Header: Messages.dumps.columns.startDate,
        accessor: 'startTime',
        type: FilterFieldTypes.TEXT,
        Cell: ({ value }) => <DetailedDate date={new Date(value).getTime()} />,
      },
      {
        Header: Messages.dumps.columns.endDate,
        accessor: 'endTime',
        type: FilterFieldTypes.TEXT,
        Cell: ({ value }) => <DetailedDate date={new Date(value).getTime()} />,
      },
      getExpandAndActionsCol(getActions),
    ],
    [getActions]
  );

  const onLogClick = (row: PMMDumpServices) => {
    setSelectedDump(row);
    setLogsModalVisible(true);
  };

  const handleLogsClose = () => {
    setLogsModalVisible(false);
  };

  const handleSelectionChange = useCallback(
    (rows: Array<Row<PMMDumpServices>>) => {
      setSelectedRows(rows);
      if (!isSendToSupportModalOpened) {
        setSelectedDumpIds(rows.map((item: Row<PMMDumpServices>) => item.values.dumpId));
      }
    },
    [isSendToSupportModalOpened]
  );

  const renderSelectedSubRow = React.useCallback(
    (row: Row<PMMDumpServices>) => {
      const serviceNames = row.original.serviceNames || [];

      return (
        <DetailsRow>
          {!!serviceNames.length && (
            <div>
              <span className={styles.serviceNamesTitle}>{Messages.dumps.columns.serviceNames}</span>
              {serviceNames.map((service) => {
                return <div key={service}>{service}</div>;
              })}
            </div>
          )}
        </DetailsRow>
      );
    },
    [styles]
  );

  return (
    <Page
      navModel={{
        main: PMM_DUMP_PAGE,
        node: PMM_DUMP_PAGE,
      }}
    >
      <Page.Contents>
        <div className={styles.createDatasetArea}>
          {selectedRows.length > 0 ? (
            <div>
              <Button
                size="md"
                variant="secondary"
                className={styles.actionButton}
                fill="outline"
                data-testid="dump-sendToSupport"
                icon="arrow-right"
                onClick={() => setIsSendToSupportModalOpened(true)}
              >
                {Messages.dumps.actions.sendToSupport}
              </Button>
              <Button
                size="md"
                variant="secondary"
                className={styles.actionButton}
                fill="outline"
                data-testid="dump-primary"
                icon="download-alt"
                disabled={
                  selectedRows.filter((item) => item.original.status !== DumpStatus.DUMP_STATUS_SUCCESS).length > 0 ||
                  isDeleting
                }
                onClick={() => onDownload()}
              >
                {Messages.dumps.actions.download} {selectedRows.length} items
              </Button>
              <Button
                size="md"
                variant="secondary"
                className={styles.actionButton}
                fill="outline"
                data-testid="dump-primary"
                icon="trash-alt"
                disabled={isDownloading}
                onClick={() => onDelete()}
              >
                {Messages.dumps.actions.delete} {selectedRows.length} items
              </Button>
            </div>
          ) : (
            <div>{Messages.dumps.actions.selectServices}</div>
          )}
          <LinkButton href={NEW_BACKUP_URL} size="md" variant="primary" data-testid="create-dataset" icon="plus">
            {Messages.dumps.createDataset}
          </LinkButton>
        </div>
        {isSendToSupportModalOpened && (
          <SendToSupportModal onClose={() => closeEditModal()} dumpIds={selectedDumpIds} />
        )}
        <Table
          columns={columns}
          data={dumps}
          totalItems={dumps.length}
          rowSelection
          onRowSelection={handleSelectionChange}
          showPagination
          pageSize={25}
          allRowsSelectionMode="page"
          emptyMessage={Messages.dumps.emptyTable}
          overlayClassName={styles.overlay}
          renderExpandedRow={renderSelectedSubRow}
          autoResetExpanded={false}
          autoResetSelectedRows={false}
          getRowId={useCallback((row: PMMDumpServices) => row.dumpId, [])}
        />
        {logsModalVisible && (
          <PmmDumpLogsModal
            title={Messages.dumpLogs.getLogsTitle(selectedDump?.dumpId || '')}
            isVisible
            onClose={handleLogsClose}
            getLogChunks={getLogs}
          />
        )}
      </Page.Contents>
    </Page>
  );
};

export default PMMDump;
