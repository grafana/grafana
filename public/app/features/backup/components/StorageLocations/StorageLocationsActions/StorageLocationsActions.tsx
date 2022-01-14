import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { DBIcon } from '../../DBIcon';
import { StorageLocatationsActionProps } from './StorageLocationsActions.types';
import { getStyles } from './StorageLocationsActions.styles';

export const StorageLocationsActions: FC<StorageLocatationsActionProps> = ({ location, onDelete }) => {
  const styles = useStyles(getStyles);

  const onDeleteClick = () => onDelete(location);

  return (
    <div className={styles.actionsWrapper}>
      <DBIcon type="edit" data-qa="edit-storage-location-button" role="button" />
      <DBIcon type="delete" data-qa="delete-storage-location-button" role="button" onClick={onDeleteClick} />
    </div>
  );
};
