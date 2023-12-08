import React, { FC } from 'react';

import { Icon, Spinner, Switch, Tooltip, useStyles2 } from '@grafana/ui';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';

import { Messages } from './ScheduledBackupsActions.messages';
import { getStyles } from './ScheduledBackupsActions.styles';
import { ScheduledBackupsActionsProps } from './ScheduledBackupsActions.types';

export const ScheduledBackupsActions: FC<ScheduledBackupsActionsProps> = ({
  row,
  backup,
  onEdit = () => {},
  onCopy = () => {},
  onDelete = () => {},
  onToggle = () => {},
  pending,
}) => {
  const styles = useStyles2(getStyles);
  const handleEdit = () => onEdit(backup);
  const handleDelete = () => onDelete(backup);
  const handleCopy = () => onCopy(backup);
  const handleToggle = () => onToggle(backup);

  const getActions = [
    {
      content: (
        <div className={styles.dropdownField}>
          <Icon data-testid="copy-scheduled-backup-button" name="copy" />
          {Messages.copy}
        </div>
      ),
      action: handleCopy,
    },
    {
      content: (
        <div className={styles.dropdownField}>
          <Icon data-testid="edit-scheduled-backpup-button" name="pen" />
          {Messages.edit}
        </div>
      ),
      action: handleEdit,
    },
    {
      content: (
        <div className={styles.dropdownField}>
          <Icon data-testid="delete-scheduled-backpup-button" name="times" />
          {Messages.delete}
        </div>
      ),
      action: handleDelete,
    },
  ];

  return (
    <div className={styles.actionsWrapper}>
      {pending ? (
        <Spinner />
      ) : (
        <>
          <span>
            <Switch value={backup.enabled} onClick={handleToggle} data-testid="toggle-scheduled-backpup" />
          </span>
          <Tooltip content={Messages.details} placement="top">
            <span>
              <ExpandableRowButton row={row} />
            </span>
          </Tooltip>
          <MultipleActions actions={getActions} dataTestId="scheduled-backups-actions" />
        </>
      )}
    </div>
  );
};
