import React, { FC, useState, useEffect } from 'react';
import { Column, Row } from 'react-table';
import { logger } from '@percona/platform-core';
import { Button, IconButton, useStyles } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { Table } from 'app/features/integrated-alerting/components/Table/Table';
import { StorageLocationsActions } from './StorageLocationsActions';
import { Messages } from './StorageLocations.messages';
import { StorageLocation } from './StorageLocations.types';
import { StorageLocationsService } from './StorageLocations.service';
import { formatLocationList, formatToRawLocation } from './StorageLocations.utils';
import { getStyles } from './StorageLocations.styles';
import { StorageLocationDetails } from './StorageLocationDetails';
import { AddStorageLocationModal } from './AddStorageLocationModal';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';

const { noData, columns } = Messages;
const { name, type, path, actions } = columns;

export const StorageLocations: FC = () => {
  const [pending, setPending] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [data, setData] = useState<StorageLocation[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const styles = useStyles(getStyles);
  const columns = React.useMemo(
    (): Column[] => [
      {
        Header: name,
        accessor: 'name',
        id: 'name',
        width: '315px',
        Cell: ({ row, value }) => {
          const restProps = row.getToggleRowExpandedProps ? row.getToggleRowExpandedProps() : {};
          return (
            <div className={styles.nameWrapper} {...restProps}>
              {value}
              {row.isExpanded ? (
                <IconButton data-qa="hide-storage-location-details" name="arrow-up" />
              ) : (
                <IconButton data-qa="show-storage-location-details" name="arrow-down" />
              )}
            </div>
          );
        },
      },
      {
        Header: type,
        accessor: 'type',
        width: '150px',
      },
      {
        Header: path,
        accessor: 'path',
      },
      {
        Header: actions,
        accessor: 'locationID',
        Cell: ({ row }) => (
          <StorageLocationsActions onDelete={onDeleteCLick} location={row.original as StorageLocation} />
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
      await StorageLocationsService.add(formatToRawLocation(location));
      appEvents.emit(AppEvents.alertSuccess, [Messages.addSuccess]);
      getData();
    } catch (e) {
      logger.error(e);
    } finally {
      setAddModalVisible(false);
    }
  };

  const onDeleteCLick = (location: StorageLocation) => {
    setSelectedLocation(location);
    setDeleteModalVisible(true);
  };

  const handleDelete = async (location: StorageLocation) => {
    setDeletePending(true);
    try {
      await StorageLocationsService.delete(location.locationID);
      setDeleteModalVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [Messages.getDeleteSuccess(location.name)]);
      getData();
    } catch (e) {
      logger.error(e);
    } finally {
      setSelectedLocation(null);
      setDeletePending(false);
    }
  };

  useEffect(() => {
    getData();
  }, []);

  return (
    <>
      <div className={styles.addWrapper}>
        <Button
          size="md"
          icon="plus-square"
          variant="link"
          data-qa="storage-location-add-modal-button"
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
        emptyMessage={noData}
        pendingRequest={pending}
        renderExpandedRow={renderSelectedSubRow}
      ></Table>
      <AddStorageLocationModal
        location={selectedLocation}
        isVisible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={onAdd}
      ></AddStorageLocationModal>
      <RemoveStorageLocationModal
        location={selectedLocation}
        isVisible={deleteModalVisible}
        setVisible={setDeleteModalVisible}
        loading={deletePending}
        onDelete={handleDelete}
      />
    </>
  );
};
