import { __awaiter } from "tslib";
/* eslint-disable react/display-name */
import cronstrue from 'cronstrue';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppEvents, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { LinkButton, useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { OldPage } from 'app/core/components/Page/Page';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
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
import { ScheduledBackupsActions } from './ScheduledBackupsActions';
import { ScheduledBackupDetails } from './ScheduledBackupsDetails';
export const ScheduledBackups = () => {
    const [data, setData] = useState([]);
    const [pending, setPending] = useState(true);
    const [actionPending, setActionPending] = useState(false);
    const [deletePending, setDeletePending] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const navModel = usePerconaNavModel('scheduled-backups');
    const [generateToken] = useCancelToken();
    const dispatch = useAppDispatch();
    const styles = useStyles(getStyles);
    const { result: locations = [] } = useSelector(getBackupLocations);
    const locationsByLocationId = useMemo(() => formatLocationsToMap(locations), [locations]);
    const retentionValue = useCallback((n) => {
        if (n < 0) {
            return '';
        }
        if (n === 0) {
            return Messages.scheduledBackups.unlimited;
        }
        return `${n} backup${n > 1 ? 's' : ''}`;
    }, []);
    const getData = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setPending(true);
        yield dispatch(fetchStorageLocations());
        try {
            const backups = yield ScheduledBackupsService.list(generateToken(LIST_SCHEDULED_BACKUPS_CANCEL_TOKEN));
            setData(backups);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setPending(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const handleCopy = useCallback((backup) => __awaiter(void 0, void 0, void 0, function* () {
        const { serviceId, locationId, cronExpression, name, description, retention, retryInterval, retryTimes, mode, dataModel, folder, } = backup;
        const newName = `${Messages.scheduledBackups.copyOf}${name}`;
        setActionPending(true);
        try {
            yield BackupService.scheduleBackup(serviceId, locationId, cronExpression, newName, description, retryInterval, retryTimes, retention, false, mode, dataModel, folder);
            getData();
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setActionPending(false);
        }
    }), [getData]);
    const handleToggle = useCallback(({ id, enabled }) => __awaiter(void 0, void 0, void 0, function* () {
        setActionPending(true);
        try {
            yield ScheduledBackupsService.toggle(id, !enabled);
            getData();
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setActionPending(false);
        }
    }), [getData]);
    const columns = useMemo(() => [
        {
            Header: Messages.scheduledBackups.table.columns.name,
            accessor: 'name',
            id: 'name',
        },
        {
            Header: Messages.scheduledBackups.table.columns.vendor,
            accessor: 'vendor',
            Cell: ({ value }) => React.createElement(React.Fragment, null, DATABASE_LABELS[value]),
        },
        {
            Header: Messages.scheduledBackups.table.columns.frequency,
            accessor: 'cronExpression',
            Cell: ({ value }) => React.createElement(React.Fragment, null, cronstrue.toString(value, { use24HourTimeFormat: true })),
        },
        {
            Header: Messages.scheduledBackups.table.columns.retention,
            accessor: 'retention',
            Cell: ({ value }) => React.createElement(React.Fragment, null, retentionValue(value)),
        },
        {
            Header: Messages.scheduledBackups.table.columns.type,
            accessor: 'mode',
            Cell: ({ value }) => React.createElement(React.Fragment, null, formatBackupMode(value)),
        },
        {
            Header: Messages.scheduledBackups.table.columns.location,
            accessor: 'locationName',
            Cell: ({ row, value }) => {
                var _a;
                return (React.createElement("span", null,
                    value,
                    " (", (_a = locationsByLocationId[row.original.locationId]) === null || _a === void 0 ? void 0 :
                    _a.type,
                    ")"));
            },
        },
        {
            Header: Messages.scheduledBackups.table.columns.lastBackup,
            accessor: 'lastBackup',
            Cell: ({ value }) => React.createElement(React.Fragment, null, value ? React.createElement(DetailedDate, { date: value }) : ''),
            width: '200px',
        },
        {
            Header: Messages.scheduledBackups.table.columns.actions,
            accessor: 'id',
            width: '150px',
            Cell: ({ row }) => (React.createElement(ScheduledBackupsActions, { row: row, pending: actionPending, backup: row.original, onToggle: handleToggle, onDelete: onDeleteClick, onEdit: onEditClick, onCopy: handleCopy })),
        },
    ], [actionPending, handleCopy, handleToggle, locationsByLocationId, retentionValue]);
    const renderSelectedSubRow = React.useCallback((row) => (React.createElement(ScheduledBackupDetails, { name: row.original.name, dataModel: row.original.dataModel, description: row.original.description, cronExpression: row.original.cronExpression, folder: row.original.folder })), []);
    const onDeleteClick = (backup) => {
        setDeleteModalVisible(true);
        setSelectedBackup(backup);
    };
    const handleDelete = () => __awaiter(void 0, void 0, void 0, function* () {
        setDeletePending(true);
        try {
            yield ScheduledBackupsService.delete(selectedBackup === null || selectedBackup === void 0 ? void 0 : selectedBackup.id);
            appEvents.emit(AppEvents.alertSuccess, [Messages.scheduledBackups.getDeleteSuccess(selectedBackup.name)]);
            setDeleteModalVisible(false);
            setSelectedBackup(null);
            getData();
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setDeletePending(false);
        }
    });
    const onEditClick = (backup) => {
        locationService.push(`/backup${backup.id}/edit`);
    };
    const getCellProps = useCallback((cell) => ({
        className: !cell.row.original.enabled ? styles.disabledRow : '',
        key: cell.row.original.id,
    }), [styles.disabledRow]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);
    useEffect(() => {
        getData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, null,
            React.createElement(FeatureLoader, { featureName: Messages.backupManagement, featureSelector: featureSelector },
                React.createElement("div", { className: styles.addWrapper },
                    React.createElement(LinkButton, { href: urlUtil.renderUrl('/backup/new', {
                            scheduled: true,
                        }), size: "md", variant: "primary", "data-testid": "scheduled-backup-add-button" }, Messages.createScheduledBackup)),
                React.createElement(Table, { columns: columns, data: data, totalItems: data.length, emptyMessage: Messages.scheduledBackups.table.noData, pendingRequest: pending, renderExpandedRow: renderSelectedSubRow, getCellProps: getCellProps, getRowId: useCallback((row) => row.id, []) }),
                React.createElement(DeleteModal, { title: Messages.scheduledBackups.deleteModalTitle, isVisible: deleteModalVisible, setVisible: setDeleteModalVisible, onDelete: handleDelete, loading: deletePending, message: Messages.scheduledBackups.getDeleteMessage(selectedBackup === null || selectedBackup === void 0 ? void 0 : selectedBackup.name) })))));
};
export default ScheduledBackups;
//# sourceMappingURL=ScheduledBackups.js.map