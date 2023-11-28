import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { OldPage } from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { fetchStorageLocations } from 'app/percona/shared/core/reducers/backups/backupLocations';
import { getBackupLocations, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { Messages } from '../../Backup.messages';
import { formatLocationsToMap } from '../../Backup.utils';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import { DetailedDate } from '../DetailedDate';
import { Status } from '../Status';
import { DATA_INTERVAL, LIST_RESTORES_CANCEL_TOKEN } from './RestoreHistory.constants';
import { RestoreHistoryService } from './RestoreHistory.service';
import { RestoreHistoryActions } from './RestoreHistoryActions';
import { RestoreHistoryDetails } from './RestoreHistoryDetails';
import { RestoreLogsModal } from './RestoreLogsModal/RestoreLogsModal';
export const RestoreHistory = () => {
    const [pending, setPending] = useState(true);
    const [logsModalVisible, setLogsModalVisible] = useState(false);
    const [data, setData] = useState([]);
    const [selectedRestore, setSelectedRestore] = useState(null);
    const navModel = usePerconaNavModel('restore-history');
    const [generateToken] = useCancelToken();
    const [triggerTimeout] = useRecurringCall();
    const dispatch = useAppDispatch();
    const { result: locations = [] } = useSelector(getBackupLocations);
    const locationsByLocationId = useMemo(() => formatLocationsToMap(locations), [locations]);
    const columns = useMemo(() => [
        {
            Header: Messages.backupInventory.table.columns.status,
            accessor: 'status',
            Cell: ({ value, row }) => (React.createElement(Status, { showLogsAction: row.original.vendor === Databases.mongodb, status: value, onLogClick: () => onLogClick(row.original) })),
            width: '100px',
        },
        {
            Header: Messages.backupInventory.table.columns.name,
            accessor: 'name',
            id: 'name',
        },
        {
            Header: Messages.backupInventory.table.columns.vendor,
            accessor: ({ vendor }) => DATABASE_LABELS[vendor],
            width: '150px',
        },
        {
            Header: Messages.restoreHistory.table.columns.started,
            accessor: 'started',
            Cell: ({ value }) => React.createElement(DetailedDate, { dataTestId: "restore-started", date: value }),
            width: '200px',
        },
        {
            Header: Messages.restoreHistory.table.columns.finished,
            accessor: 'finished',
            Cell: ({ value }) => (value ? React.createElement(DetailedDate, { dataTestId: "restore-finished", date: value }) : null),
            width: '200px',
        },
        {
            Header: Messages.restoreHistory.table.columns.targetService,
            accessor: 'serviceName',
        },
        {
            Header: Messages.backupInventory.table.columns.location,
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
            Header: Messages.restoreHistory.table.columns.actions,
            accessor: 'id',
            width: '100px',
            Cell: ({ row }) => React.createElement(RestoreHistoryActions, { row: row }),
        },
    ], 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationsByLocationId]);
    const renderSelectedSubRow = React.useCallback((row) => (React.createElement(RestoreHistoryDetails, { name: row.original.name, pitrTimestamp: row.original.pitrTimestamp, dataModel: row.original.dataModel })), []);
    const handleLogsClose = () => {
        setSelectedRestore(null);
        setLogsModalVisible(false);
    };
    const onLogClick = (restore) => {
        setSelectedRestore(restore);
        setLogsModalVisible(true);
    };
    const getLogs = useCallback((startingChunk, offset, token) => __awaiter(void 0, void 0, void 0, function* () { return RestoreHistoryService.getLogs(selectedRestore.id, startingChunk, offset, token); }), [selectedRestore]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);
    useEffect(() => {
        const getData = (showLoading = false) => __awaiter(void 0, void 0, void 0, function* () {
            showLoading && setPending(true);
            yield dispatch(fetchStorageLocations());
            try {
                const restores = yield RestoreHistoryService.list(generateToken(LIST_RESTORES_CANCEL_TOKEN));
                setData(restores);
            }
            catch (e) {
                if (isApiCancelError(e)) {
                    return;
                }
                logger.error(e);
            }
            setPending(false);
        });
        getData(true).then(() => triggerTimeout(getData, DATA_INTERVAL));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, null,
            React.createElement(FeatureLoader, { featureName: Messages.backupManagement, featureSelector: featureSelector },
                React.createElement(Table, { columns: columns, data: data, totalItems: data.length, emptyMessage: Messages.restoreHistory.table.noData, pendingRequest: pending, autoResetExpanded: false, renderExpandedRow: renderSelectedSubRow, getRowId: useCallback((row) => row.id, []) }),
                logsModalVisible && (React.createElement(RestoreLogsModal, { title: Messages.backupInventory.getLogsTitle((selectedRestore === null || selectedRestore === void 0 ? void 0 : selectedRestore.name) || ''), isVisible: true, onClose: handleLogsClose, getLogChunks: getLogs }))))));
};
export default RestoreHistory;
//# sourceMappingURL=RestoreHistory.js.map