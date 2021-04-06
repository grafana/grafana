import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { DBIcon } from '../../DBIcon';
import { StorageLocatationsActionProps } from './StorageLocationsActions.types';
import { getStyles } from './StorageLocationsActions.styles';
import { Messages } from './StorageLocationsActions.messages';

export const StorageLocationsActions: FC<StorageLocatationsActionProps> = ({ location, onUpdate, onDelete }) => {
  const styles = useStyles(getStyles);

  const handleUpdateClick = () => onUpdate(location);
  const onDeleteClick = () => onDelete(location);

  return (
    <div className={styles.actionsWrapper}>
      <DBIcon
        tooltipText={Messages.editStorageLocation}
        type="edit"
        data-qa="edit-storage-location-button"
        role="button"
        onClick={handleUpdateClick}
      />
      <DBIcon
        tooltipText={Messages.deleteStorageLocation}
        type="delete"
        data-qa="delete-storage-location-button"
        role="button"
        onClick={onDeleteClick}
      />
    </div>
  );
};
