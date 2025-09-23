/* eslint-disable react/display-name */
import cronstrue from 'cronstrue';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Row } from 'react-table';

import { AppEvents, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { LinkButton, useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { BackupType } from 'app/percona/backup/Backup.types';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { fetchStorageLocations } from 'app/percona/shared/core/reducers/backups/backupLocations';
import { getBackupLocations, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages } from '../../Backup.messages';
import { BackupService } from '../../Backup.service';
import { formatBackupMode, formatLocationsToMap } from '../../Backup.utils';
import { DetailedDate } from '../DetailedDate';

import { LIST_SCHEDULED_BACKUPS_CANCEL_TOKEN } from './ScheduledBackups.constants';
import { ScheduledBackupsService } from './ScheduledBackups.service';
import { getStyles } from './ScheduledBackups.styles';
import { ScheduledBackup } from './ScheduledBackups.types';
import { ScheduledBackupsActions } from './ScheduledBackupsActions';
import { ScheduledBackupDetails } from './ScheduledBackupsDetails';

export const ScheduledBackups: FC = () => {
  const [data, setData] = useState<ScheduledBackup[]>([]);
  const [pending, setPending] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<ScheduledBackup | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [generateToken] = useCancelToken();
  const dispatch = useAppDispatch();
  const styles = useStyles(getStyles);
  const { result: locations = [] } = useSelector(getBackupLocations);
  const locationsByLocationId = useMemo(() => formatLocationsToMap(locations), [locations]);
  const retentionValue = useCallback((n: number) => {
    if (n < 0) {
      return '';
    }

    if (n === 0) {
      return Messages.scheduledBackups.unlimited;
    }

    return `${n} backup${n > 1 ? 's' : ''}`;
  }, []);

  const getData = useCallback(async () => {
    setPending(true);
    await dispatch(fetchStorageLocations());
    try {
      const backups = await ScheduledBackupsService.list(generateToken(LIST_SCHEDULED_BACKUPS_CANCEL_TOKEN));
      setData(backups);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = useCallback(
    async (backup: ScheduledBackup) => {
      const {
        serviceId,
        locationId,
        cronExpression,
        name,
        description,
        retention,
        retryInterval,
        retryTimes,
        mode,
        dataModel,
        folder,
      } = backup;
      const newName = `${Messages.scheduledBackups.copyOf}${name}`;
      setActionPending(true);
      try {
        await BackupService.scheduleBackup(
          serviceId,
          locationId,
          cronExpression,
          newName,
          description,
          retryInterval,
          retryTimes,
          retention,
          false,
          mode,
          dataModel,
          folder
        );
        getData();
      } catch (e) {
        logger.error(e);
      } finally {
        setActionPending(false);
      }
    },
    [getData]
  );

  const handleToggle = useCallback(
    async ({ id, enabled }: ScheduledBackup) => {
      setActionPending(true);
      try {
        await ScheduledBackupsService.toggle(id, !enabled);
        getData();
      } catch (e) {
        logger.error(e);
      } finally {
        setActionPending(false);
      }
    },
    [getData]
  );

  const columns = useMemo(
    (): Array<ExtendedColumn<ScheduledBackup>> => [
      {
        Header: Messages.scheduledBackups.table.columns.name,
        accessor: 'name',
        id: 'name',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.scheduledBackups.table.columns.vendor,
        accessor: 'vendor',
        Cell: ({ value }) => DATABASE_LABELS[value],
        type: FilterFieldTypes.DROPDOWN,
        options: Object.values(DATABASE_LABELS).map((item: string) => ({
          label: item,
          value: item,
        })),
      },
      {
        Header: Messages.scheduledBackups.table.columns.frequency,
        accessor: 'cronExpression',
        Cell: ({ value }) => cronstrue.toString(value, { use24HourTimeFormat: true }),
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.scheduledBackups.table.columns.retention,
        accessor: 'retention',
        Cell: ({ value }) => retentionValue(value),
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.scheduledBackups.table.columns.type,
        accessor: 'mode',
        Cell: ({ value }) => formatBackupMode(value),
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.scheduledBackups.table.columns.location,
        accessor: 'locationName',
        Cell: ({ row, value }) => (
          <span>
            {value} ({locationsByLocationId[row.original.locationId]?.type})
          </span>
        ),
        type: FilterFieldTypes.DROPDOWN,
        options: locations.map((item) => ({
          label: item.name,
          value: item.name,
        })),
      },
      {
        Header: Messages.scheduledBackups.table.columns.lastBackup,
        accessor: 'lastBackup',
        Cell: ({ value }) => <>{value ? <DetailedDate date={value} /> : ''}</>,
        width: '200px',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.scheduledBackups.table.columns.actions,
        accessor: 'id',
        width: '150px',
        type: FilterFieldTypes.TEXT,
        Cell: ({ row }) => (
          <ScheduledBackupsActions
            row={row}
            pending={actionPending}
            backup={row.original}
            onToggle={handleToggle}
            onDelete={onDeleteClick}
            onEdit={onEditClick}
            onCopy={handleCopy}
          />
        ),
      },
    ],
    [actionPending, handleCopy, handleToggle, locationsByLocationId, retentionValue, locations]
  );

  const renderSelectedSubRow = React.useCallback(
    (row: Row<ScheduledBackup>) => (
      <ScheduledBackupDetails
        name={row.original.name}
        dataModel={row.original.dataModel}
        description={row.original.description}
        cronExpression={row.original.cronExpression}
        folder={row.original.folder}
      />
    ),
    []
  );

  const onDeleteClick = (backup: ScheduledBackup) => {
    setDeleteModalVisible(true);
    setSelectedBackup(backup);
  };

  const handleDelete = async () => {
    setDeletePending(true);
    try {
      await ScheduledBackupsService.delete(selectedBackup?.id!);
      appEvents.emit(AppEvents.alertSuccess, [Messages.scheduledBackups.getDeleteSuccess(selectedBackup!.name)]);
      setDeleteModalVisible(false);
      setSelectedBackup(null);
      getData();
    } catch (e) {
      logger.error(e);
    } finally {
      setDeletePending(false);
    }
  };

  const onEditClick = (backup: ScheduledBackup) => {
    locationService.push(`/backup/${BackupType.SCHEDULED}/${backup.id}/edit`);
  };

  const getCellProps = useCallback(
    (cell: Cell<ScheduledBackup>) => ({
      className: !cell.row.original.enabled ? styles.disabledRow : '',
      key: cell.row.original.id,
    }),
    [styles.disabledRow]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);

  useEffect(() => {
    getData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page navId="scheduled-backups">
      <Page.Contents>
        <FeatureLoader featureName={Messages.backupManagement} featureSelector={featureSelector}>
          <div className={styles.addWrapper}>
            <LinkButton
              href={urlUtil.renderUrl('/backup/new', {
                scheduled: true,
              })}
              size="md"
              variant="primary"
              data-testid="scheduled-backup-add-button"
            >
              {Messages.createScheduledBackup}
            </LinkButton>
          </div>
          <Table
            columns={columns}
            data={data}
            totalItems={data.length}
            emptyMessage={Messages.scheduledBackups.table.noData}
            pendingRequest={pending}
            renderExpandedRow={renderSelectedSubRow}
            getCellProps={getCellProps}
            getRowId={useCallback((row: ScheduledBackup) => row.id, [])}
            showFilter
          />
          <DeleteModal
            title={Messages.scheduledBackups.deleteModalTitle}
            isVisible={deleteModalVisible}
            setVisible={setDeleteModalVisible}
            onDelete={handleDelete}
            loading={deletePending}
            message={Messages.scheduledBackups.getDeleteMessage(selectedBackup?.name!)}
          />
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default ScheduledBackups;
