import React, { FC } from 'react';

import { Tooltip, useStyles2 } from '@grafana/ui';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';

import { Messages } from './RestoreHistoryActions.messages';
import { getStyles } from './RestoreHistoryActions.styles';
import { BackupInventoryActionsProps } from './RestoreHistoryActions.types';

export const RestoreHistoryActions: FC<BackupInventoryActionsProps> = ({ row }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.actionsWrapper}>
      <Tooltip content={Messages.details} placement="top">
        <span>
          <ExpandableRowButton row={row} />
        </span>
      </Tooltip>
    </div>
  );
};
