import React, { FC } from 'react';

import { Tooltip, useStyles2 } from '@grafana/ui';
import { Action, MultipleActions } from 'app/percona/dbaas/components/MultipleActions';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';

import { DBIcon } from '../../DBIcon';

import { Messages } from './StorageLocationsActions.messages';
import { getStyles } from './StorageLocationsActions.styles';
import { StorageLocatationsActionProps } from './StorageLocationsActions.types';

export const StorageLocationsActions: FC<StorageLocatationsActionProps> = ({ row, location, onUpdate, onDelete }) => {
  const styles = useStyles2(getStyles);
  const handleUpdateClick = () => onUpdate(location);
  const onDeleteClick = () => onDelete(location);

  const getActions: Action[] = [
    {
      content: (
        <div className={styles.dropdownField}>
          <DBIcon type="edit" data-testid="edit-storage-location-button" role="button" />
          {Messages.editStorageLocation}
        </div>
      ),
      action: handleUpdateClick,
    },
    {
      content: (
        <div className={styles.dropdownField}>
          <DBIcon type="delete" data-testid="delete-storage-location-button" role="button" />
          {Messages.deleteStorageLocation}
        </div>
      ),
      action: onDeleteClick,
    },
  ];

  return (
    <div className={styles.actionsWrapper}>
      <Tooltip content={Messages.details} placement="top">
        <span>
          <ExpandableRowButton row={row} />
        </span>
      </Tooltip>
      <MultipleActions actions={getActions} dataTestId="storage-location-actions" />
    </div>
  );
};
