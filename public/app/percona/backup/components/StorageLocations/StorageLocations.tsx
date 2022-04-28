/* eslint-disable react/display-name */
import React, { FC, useState, useEffect, useCallback } from 'react';
import { Column, Row } from 'react-table';
import { logger } from '@percona/platform-core';
import Page from 'app/core/components/Page/Page';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { TechnicalPreview } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { Button, useStyles } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { StorageLocationsActions } from './StorageLocationsActions';
import { Messages } from '../../Backup.messages';
import { StorageLocation } from './StorageLocations.types';
import { StorageLocationsService } from './StorageLocations.service';
import { formatLocationList, formatToRawLocation } from './StorageLocations.utils';
import { getStyles } from './StorageLocations.styles';
import { StorageLocationDetails } from './StorageLocationDetails';
import { AddStorageLocationModal } from './AddStorageLocationModal';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';
import { ExpandableCell } from 'app/percona/shared/components/Elements/ExpandableCell';

export const StorageLocations: FC = () => {
  const [pending, setPending] = useState(true);
  const [validatingLocation, setValidatingLocation] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [data, setData] = useState<StorageLocation[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const navModel = usePerconaNavModel('storage-locations');
  const styles = useStyles(getStyles);
  const columns = React.useMemo(
    (): Array<Column<StorageLocation>> => [
      {
        Header: Messages.storageLocations.table.columns.name,
        accessor: 'name',
        id: 'name',
        width: '315px',
        Cell: ({ row, value }) => <ExpandableCell row={row} value={value} />,
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
        Cell: ({ row }) => (
          <StorageLocationsActions
            onUpdate={handleUpdate}
            onDelete={onDeleteCLick}
            location={row.original as StorageLocation}
          />
        ),
        width: '130px',
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
    (row: Row) => <StorageLocationDetails location={row.original as StorageLocation} />,
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
    <Page navModel={navModel}>
      <Page.Contents>
        <TechnicalPreview />
        <FeatureLoader featureName={Messages.backupManagement} featureSelector={featureSelector}>
          <div className={styles.addWrapper}>
            <Button
              size="md"
              icon="plus-square"
              variant="link"
              data-testid="storage-location-add-modal-button"
              onClick={() => {
                setSelectedLocation(null);
                setAddModalVisible(true);
              }}
            >
              {Messages.add}
            </Button>
          </div>
          <Table
            data={data}
            totalItems={data.length}
            columns={columns}
            emptyMessage={Messages.storageLocations.table.noData}
            pendingRequest={pending}
            renderExpandedRow={renderSelectedSubRow}
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
