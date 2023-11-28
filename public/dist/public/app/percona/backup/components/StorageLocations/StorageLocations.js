import { __awaiter } from "tslib";
/* eslint-disable react/display-name, @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { OldPage } from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { Table } from 'app/percona/shared/components/Elements/Table';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';
import { Messages } from '../../Backup.messages';
import { AddStorageLocationModal } from './AddStorageLocationModal';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';
import { StorageLocationDetails } from './StorageLocationDetails';
import { StorageLocationsService } from './StorageLocations.service';
import { getStyles } from './StorageLocations.styles';
import { formatLocationList, formatToRawLocation } from './StorageLocations.utils';
import { StorageLocationsActions } from './StorageLocationsActions';
export const StorageLocations = () => {
    const [pending, setPending] = useState(true);
    const [validatingLocation, setValidatingLocation] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deletePending, setDeletePending] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [data, setData] = useState([]);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const navModel = usePerconaNavModel('storage-locations');
    const styles = useStyles(getStyles);
    const columns = React.useMemo(() => [
        {
            Header: Messages.storageLocations.table.columns.name,
            accessor: 'name',
            id: 'name',
            width: '315px',
        },
        {
            Header: Messages.storageLocations.table.columns.type,
            accessor: 'type',
            width: '150px',
        },
        {
            Header: Messages.storageLocations.table.columns.path,
            accessor: 'path',
        },
        {
            Header: Messages.storageLocations.table.columns.actions,
            accessor: 'locationID',
            Cell: ({ row }) => (React.createElement(StorageLocationsActions, { row: row, onUpdate: handleUpdate, onDelete: onDeleteCLick, location: row.original })),
            width: '100px',
        },
    ], []);
    const getData = () => __awaiter(void 0, void 0, void 0, function* () {
        setPending(true);
        try {
            const rawData = yield StorageLocationsService.list();
            setData(formatLocationList(rawData));
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setPending(false);
        }
    });
    const renderSelectedSubRow = React.useCallback((row) => React.createElement(StorageLocationDetails, { location: row.original }), []);
    const onAdd = (location) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (location.locationID) {
                yield StorageLocationsService.update(formatToRawLocation(location));
                appEvents.emit(AppEvents.alertSuccess, [Messages.storageLocations.editSuccess(location.name)]);
            }
            else {
                yield StorageLocationsService.add(formatToRawLocation(location));
                appEvents.emit(AppEvents.alertSuccess, [Messages.storageLocations.addSuccess]);
            }
            setAddModalVisible(false);
            setSelectedLocation(null);
            getData();
        }
        catch (e) {
            logger.error(e);
        }
    });
    const handleUpdate = (location) => {
        setSelectedLocation(location);
        setAddModalVisible(true);
    };
    const handleTest = (location) => __awaiter(void 0, void 0, void 0, function* () {
        setValidatingLocation(true);
        try {
            const rawLocation = formatToRawLocation(location, true);
            yield StorageLocationsService.testLocation(rawLocation);
            appEvents.emit(AppEvents.alertSuccess, [Messages.storageLocations.testSuccess]);
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setValidatingLocation(false);
        }
    });
    const onDeleteCLick = (location) => {
        setSelectedLocation(location);
        setDeleteModalVisible(true);
    };
    const handleDelete = (location, force) => __awaiter(void 0, void 0, void 0, function* () {
        if (location) {
            setDeletePending(true);
            try {
                yield StorageLocationsService.delete(location.locationID, force);
                setDeleteModalVisible(false);
                setSelectedLocation(null);
                appEvents.emit(AppEvents.alertSuccess, [Messages.storageLocations.getDeleteSuccess(location.name)]);
                getData();
            }
            catch (e) {
                logger.error(e);
            }
            finally {
                setDeletePending(false);
            }
        }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);
    useEffect(() => {
        getData();
    }, []);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, null,
            React.createElement(FeatureLoader, { featureName: Messages.backupManagement, featureSelector: featureSelector },
                React.createElement("div", { className: styles.addWrapper },
                    React.createElement(Button, { size: "md", variant: "primary", "data-testid": "storage-location-add-modal-button", onClick: () => {
                            setSelectedLocation(null);
                            setAddModalVisible(true);
                        } }, Messages.addStorageLocation)),
                React.createElement(Table, { data: data, totalItems: data.length, columns: columns, emptyMessage: Messages.storageLocations.table.noData, pendingRequest: pending, renderExpandedRow: renderSelectedSubRow, getRowId: useCallback((row) => row.locationID, []) }),
                React.createElement(AddStorageLocationModal, { location: selectedLocation, isVisible: addModalVisible, waitingLocationValidation: validatingLocation, onClose: () => setAddModalVisible(false), onAdd: onAdd, onTest: handleTest }),
                React.createElement(RemoveStorageLocationModal, { location: selectedLocation, isVisible: deleteModalVisible, setVisible: setDeleteModalVisible, loading: deletePending, onDelete: handleDelete })))));
};
export default StorageLocations;
//# sourceMappingURL=StorageLocations.js.map