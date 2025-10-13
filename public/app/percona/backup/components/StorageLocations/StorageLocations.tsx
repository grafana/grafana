/* eslint-disable react/display-name, @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */
import React, { FC, useCallback, useEffect, useState } from 'react';
import { Row } from 'react-table';

import { AppEvents } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';

import { Messages } from '../../Backup.messages';

import { AddStorageLocationModal } from './AddStorageLocationModal';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';
import { StorageLocationDetails } from './StorageLocationDetails';
import { StorageLocationsService } from './StorageLocations.service';
import { getStyles } from './StorageLocations.styles';
import { LocationType, StorageLocation } from './StorageLocations.types';
import { formatLocationList, formatToRawLocation } from './StorageLocations.utils';
import { StorageLocationsActions } from './StorageLocationsActions';

export const StorageLocations: FC = () => {
  const [pending, setPending] = useState(true);
  const [validatingLocation, setValidatingLocation] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [data, setData] = useState<StorageLocation[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const styles = useStyles(getStyles);
  const columns = React.useMemo(
    (): Array<ExtendedColumn<StorageLocation>> => [
      {
        Header: Messages.storageLocations.table.columns.name,
        accessor: 'name',
        id: 'name',
        width: '315px',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.storageLocations.table.columns.type,
        accessor: 'type',
        width: '150px',
        type: FilterFieldTypes.DROPDOWN,
        options: [
          {
            value: LocationType.S3,
            label: LocationType.S3,
          },
          {
            value: LocationType.CLIENT,
            label: LocationType.CLIENT,
          },
        ],
      },
      {
        Header: Messages.storageLocations.table.columns.path,
        accessor: 'path',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.storageLocations.table.columns.actions,
        type: FilterFieldTypes.TEXT,
        accessor: 'locationID',
        Cell: ({ row }) => (
          <StorageLocationsActions row={row} onUpdate={handleUpdate} onDelete={onDeleteCLick} location={row.original} />
        ),
        width: '100px',
      },
    ],
    []
  );

  const getData = async () => {
    setPending(true);
    try {
      const rawData = await StorageLocationsService.list();
      setData(formatLocationList(rawData));
    } catch (e) {
      logger.error(e);
    } finally {
      setPending(false);
    }
  };

  const renderSelectedSubRow = React.useCallback(
    (row: Row<StorageLocation>) => <StorageLocationDetails location={row.original} />,
    []
  );

  const onAdd = async (location: StorageLocation) => {
    try {
      if (location.locationID) {
        await StorageLocationsService.update(formatToRawLocation(location));
        appEvents.emit(AppEvents.alertSuccess, [Messages.storageLocations.editSuccess(location.name)]);
      } else {
        await StorageLocationsService.add(formatToRawLocation(location));
        appEvents.emit(AppEvents.alertSuccess, [Messages.storageLocations.addSuccess]);
      }
      setAddModalVisible(false);
      setSelectedLocation(null);
      getData();
    } catch (e) {
      logger.error(e);
    }
  };

  const handleUpdate = (location: StorageLocation) => {
    setSelectedLocation(location);
    setAddModalVisible(true);
  };

  const handleTest = async (location: StorageLocation) => {
    setValidatingLocation(true);
    try {
      const rawLocation = formatToRawLocation(location, true);
      await StorageLocationsService.testLocation(rawLocation);
      appEvents.emit(AppEvents.alertSuccess, [Messages.storageLocations.testSuccess]);
    } catch (e) {
      logger.error(e);
    } finally {
      setValidatingLocation(false);
    }
  };

  const onDeleteCLick = (location: StorageLocation) => {
    setSelectedLocation(location);
    setDeleteModalVisible(true);
  };

  const handleDelete = async (location: StorageLocation | null, force: boolean) => {
    if (location) {
      setDeletePending(true);
      try {
        await StorageLocationsService.delete(location.locationID, force);
        setDeleteModalVisible(false);
        setSelectedLocation(null);
        appEvents.emit(AppEvents.alertSuccess, [Messages.storageLocations.getDeleteSuccess(location.name)]);
        getData();
      } catch (e) {
        logger.error(e);
      } finally {
        setDeletePending(false);
      }
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);

  useEffect(() => {
    getData();
  }, []);

  return (
    <Page navId="storage-locations">
      <Page.Contents>
        <FeatureLoader featureName={Messages.backupManagement} featureSelector={featureSelector}>
          <div className={styles.addWrapper}>
            <Button
              size="md"
              variant="primary"
              data-testid="storage-location-add-modal-button"
              onClick={() => {
                setSelectedLocation(null);
                setAddModalVisible(true);
              }}
            >
              {Messages.addStorageLocation}
            </Button>
          </div>
          <Table
            data={data}
            totalItems={data.length}
            columns={columns}
            emptyMessage={Messages.storageLocations.table.noData}
            pendingRequest={pending}
            renderExpandedRow={renderSelectedSubRow}
            getRowId={useCallback((row: StorageLocation) => row.locationID, [])}
            showFilter
          ></Table>
          <AddStorageLocationModal
            location={selectedLocation}
            isVisible={addModalVisible}
            waitingLocationValidation={validatingLocation}
            onClose={() => setAddModalVisible(false)}
            onAdd={onAdd}
            onTest={handleTest}
          ></AddStorageLocationModal>
          <RemoveStorageLocationModal
            location={selectedLocation}
            isVisible={deleteModalVisible}
            setVisible={setDeleteModalVisible}
            loading={deletePending}
            onDelete={handleDelete}
          />
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default StorageLocations;
