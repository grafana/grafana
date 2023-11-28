import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { OldPage } from 'app/core/components/Page/Page';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { fetchStorageLocations } from 'app/percona/shared/core/reducers/backups/backupLocations';
import { getBackupLocations, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { apiErrorParser, isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { NEW_BACKUP_URL, RESTORES_URL } from '../../Backup.constants';
import { Messages } from '../../Backup.messages';
import { formatBackupMode } from '../../Backup.utils';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import { DetailedDate } from '../DetailedDate';
import { Status } from '../Status';
import { LocationType } from '../StorageLocations/StorageLocations.types';
import { DATA_INTERVAL, LIST_ARTIFACTS_CANCEL_TOKEN, RESTORE_CANCEL_TOKEN } from './BackupInventory.constants';
import { BackupInventoryService } from './BackupInventory.service';
import { getStyles } from './BackupInventory.styles';
import { BackupInventoryActions } from './BackupInventoryActions';
import { BackupInventoryDetails } from './BackupInventoryDetails';
import { BackupLogsModal } from './BackupLogsModal/BackupLogsModal';
import { RestoreBackupModal } from './RestoreBackupModal';
export const BackupInventory = () => {
    var _a, _b;
    const [pending, setPending] = useState(true);
    const [deletePending, setDeletePending] = useState(false);
    const [restoreModalVisible, setRestoreModalVisible] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [logsModalVisible, setLogsModalVisible] = useState(false);
    const [data, setData] = useState([]);
    const dispatch = useAppDispatch();
    const [restoreErrors, setRestoreErrors] = useState([]);
    const backupLocationMap = useRef({});
    const navModel = usePerconaNavModel('backup-inventory');
    const [triggerTimeout] = useRecurringCall();
    const [generateToken] = useCancelToken();
    const { result: locations = [] } = useSelector(getBackupLocations);
    const columns = useMemo(() => [
        {
            Header: Messages.backupInventory.table.columns.status,
            accessor: 'status',
            width: '100px',
            Cell: ({ value, row }) => (React.createElement(Status, { showLogsAction: row.original.vendor === Databases.mongodb, status: value, onLogClick: () => onLogClick(row.original) })),
        },
        {
            Header: Messages.backupInventory.table.columns.name,
            accessor: 'name',
            id: 'name',
        },
        {
            Header: Messages.backupInventory.table.columns.service,
            accessor: 'serviceName',
        },
        {
            Header: Messages.backupInventory.table.columns.vendor,
            accessor: ({ vendor }) => DATABASE_LABELS[vendor],
            width: '150px',
        },
        {
            Header: Messages.backupInventory.table.columns.created,
            accessor: 'created',
            width: '200px',
            Cell: ({ value }) => React.createElement(DetailedDate, { date: value }),
        },
        {
            Header: Messages.backupInventory.table.columns.type,
            accessor: 'mode',
            Cell: ({ value }) => React.createElement(React.Fragment, null, formatBackupMode(value)),
        },
        {
            Header: Messages.backupInventory.table.columns.location,
            accessor: 'locationName',
            width: '250px',
            Cell: ({ row, value }) => {
                var _a;
                return (React.createElement("span", null,
                    value,
                    " (", (_a = backupLocationMap.current[row.values.id]) === null || _a === void 0 ? void 0 :
                    _a.type,
                    ")"));
            },
        },
        {
            Header: Messages.backupInventory.table.columns.actions,
            accessor: 'id',
            Cell: ({ row }) => (React.createElement(BackupInventoryActions, { row: row, onRestore: onRestoreClick, onBackup: onBackupClick, backup: row.original, onDelete: onDeleteClick })),
            width: '100px',
        },
    ], 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backupLocationMap]);
    const styles = useStyles2(getStyles);
    const onRestoreClick = (backup) => {
        setSelectedBackup(backup);
        setRestoreModalVisible(true);
    };
    const onDeleteClick = (backup) => {
        setSelectedBackup(backup);
        setDeleteModalVisible(true);
    };
    const onLogClick = (backup) => {
        setSelectedBackup(backup);
        setLogsModalVisible(true);
    };
    const handleClose = () => {
        setRestoreModalVisible(false);
        setSelectedBackup(null);
        setRestoreErrors([]);
    };
    const handleLogsClose = () => {
        setSelectedBackup(null);
        setLogsModalVisible(false);
    };
    const handleRestore = (serviceId, artifactId, pitrTimestamp) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield BackupInventoryService.restore(serviceId, artifactId, pitrTimestamp, generateToken(RESTORE_CANCEL_TOKEN));
            setRestoreErrors([]);
            setRestoreModalVisible(false);
            appEvents.emit(AppEvents.alertSuccess, [Messages.backupInventory.restoreStarted]);
            locationService.push(RESTORES_URL);
        }
        catch (e) {
            setRestoreErrors(apiErrorParser(e));
            logger.error(e);
        }
    });
    const getData = useCallback((showLoading = false) => __awaiter(void 0, void 0, void 0, function* () {
        showLoading && setPending(true);
        try {
            const backups = yield BackupInventoryService.list(generateToken(LIST_ARTIFACTS_CANCEL_TOKEN));
            backups.forEach((backup) => {
                if (!backupLocationMap.current[backup.id]) {
                    backupLocationMap.current[backup.id] = locations.find((location) => location.locationID === backup.locationId);
                }
            });
            setData(backups);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setPending(false);
    }), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations]);
    const handleDelete = useCallback((force = false) => __awaiter(void 0, void 0, void 0, function* () {
        var _c;
        try {
            setDeletePending(true);
            yield BackupInventoryService.delete(selectedBackup.id, force);
            setDeleteModalVisible(false);
            setSelectedBackup(null);
            appEvents.emit(AppEvents.alertSuccess, [Messages.backupInventory.getDeleteSuccess((_c = selectedBackup === null || selectedBackup === void 0 ? void 0 : selectedBackup.name) !== null && _c !== void 0 ? _c : '')]);
            getData(true);
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setDeletePending(false);
        }
    }), [getData, selectedBackup]);
    const getLogs = useCallback((startingChunk, offset, token) => __awaiter(void 0, void 0, void 0, function* () {
        return BackupInventoryService.getLogs(selectedBackup.id, startingChunk, offset, token);
    }), [selectedBackup]);
    const renderSelectedSubRow = React.useCallback((row) => (React.createElement(BackupInventoryDetails, { name: row.original.name, status: row.original.status, dataModel: row.original.dataModel, folder: row.original.folder })), []);
    const onBackupClick = (backup) => {
        if (backup) {
            locationService.push(`/backup${backup.id}/edit`);
        }
        else {
            locationService.push(NEW_BACKUP_URL);
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);
    useEffect(() => {
        dispatch(fetchStorageLocations());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        getData(true).then(() => triggerTimeout(getData, DATA_INTERVAL));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getData]);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, null,
            React.createElement(FeatureLoader, { featureName: Messages.backupManagement, featureSelector: featureSelector },
                React.createElement("div", { className: styles.addWrapper },
                    React.createElement(LinkButton, { href: NEW_BACKUP_URL, size: "md", variant: "primary", "data-testid": "backup-add-button" }, Messages.createNewBackup)),
                React.createElement(Table, { data: data, totalItems: data.length, columns: columns, emptyMessage: Messages.backupInventory.table.noData, pendingRequest: pending, autoResetExpanded: false, renderExpandedRow: renderSelectedSubRow, getRowId: useCallback((row) => row.id, []) }),
                restoreModalVisible && (React.createElement(RestoreBackupModal, { backup: selectedBackup, location: selectedBackup ? backupLocationMap.current[selectedBackup.id] : undefined, isVisible: true, restoreErrors: restoreErrors, onClose: handleClose, onRestore: handleRestore, noService: !(selectedBackup === null || selectedBackup === void 0 ? void 0 : selectedBackup.serviceId) || !(selectedBackup === null || selectedBackup === void 0 ? void 0 : selectedBackup.serviceName) })),
                deleteModalVisible && (React.createElement(DeleteModal, { title: Messages.backupInventory.deleteModalTitle, message: Messages.backupInventory.getDeleteMessage((selectedBackup === null || selectedBackup === void 0 ? void 0 : selectedBackup.name) || ''), isVisible: true, setVisible: setDeleteModalVisible, forceLabel: Messages.backupInventory.deleteFromStorage, onDelete: handleDelete, initialForceValue: true, loading: deletePending, showForce: !!selectedBackup && ((_a = backupLocationMap.current[selectedBackup.id]) === null || _a === void 0 ? void 0 : _a.type) !== LocationType.CLIENT }, !!selectedBackup && ((_b = backupLocationMap.current[selectedBackup.id]) === null || _b === void 0 ? void 0 : _b.type) === LocationType.CLIENT && (React.createElement(Alert, { title: "" }, Messages.backupInventory.deleteWarning)))),
                logsModalVisible && (React.createElement(BackupLogsModal, { title: Messages.backupInventory.getLogsTitle((selectedBackup === null || selectedBackup === void 0 ? void 0 : selectedBackup.name) || ''), isVisible: true, onClose: handleLogsClose, getLogChunks: getLogs }))))));
};
export default BackupInventory;
//# sourceMappingURL=BackupInventory.js.map