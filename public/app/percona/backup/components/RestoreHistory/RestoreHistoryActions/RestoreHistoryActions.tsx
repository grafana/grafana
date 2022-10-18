import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';

import { getStyles } from './RestoreHistoryActions.styles';
import { BackupInventoryActionsProps } from './RestoreHistoryActions.types';

export const RestoreHistoryActions: FC<BackupInventoryActionsProps> = ({ row }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.actionsWrapper}>
      <ExpandableRowButton row={row} />
    </div>
  );
};
