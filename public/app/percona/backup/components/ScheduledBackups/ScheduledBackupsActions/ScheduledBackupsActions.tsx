import React, { FC } from 'react';
import { IconButton, Spinner, Switch, useStyles } from '@grafana/ui';
import { getStyles } from './ScheduledBackupsActions.styles';
import { ScheduledBackupsActionsProps } from './ScheduledBackupsActions.types';

export const ScheduledBackupsActions: FC<ScheduledBackupsActionsProps> = ({
  backup,
  onEdit = () => {},
  onCopy = () => {},
  onDelete = () => {},
  onToggle = () => {},
  pending,
}) => {
  const styles = useStyles(getStyles);
  const handleEdit = () => onEdit(backup);
  const handleDelete = () => onDelete(backup);
  const handleCopy = () => onCopy(backup);
  const handleToggle = () => onToggle(backup);

  return (
    <div className={styles.actionsWrapper}>
      {pending ? (
        <Spinner />
      ) : (
        <>
          <Switch value={backup.enabled} onClick={handleToggle} data-qa="toggle-scheduled-backpup" />
          <IconButton data-qa="edit-scheduled-backpup-button" name="pen" onClick={handleEdit} />
          <IconButton data-qa="delete-scheduled-backpup-button" name="times" onClick={handleDelete} />
          <IconButton data-qa="copy-alert-scheduled-backup-button" name="copy" onClick={handleCopy} />
        </>
      )}
    </div>
  );
};
