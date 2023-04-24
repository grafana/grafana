import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

export interface Props {}

export function BrowseActions() {
  const styles = useStyles2(getStyles);

  const onMove = () => {
    // TODO real implemenation, stub for now
    console.log('onMoveClicked');
  };

  const onDelete = () => {
    // TODO real implementation, stub for now
    console.log('onDeleteClicked');
  };

  return (
    <div className={styles.row} data-testid="manage-actions">
      <Button onClick={onMove} variant="secondary">
        Move
      </Button>
      <Button onClick={onDelete} variant="destructive">
        Delete
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  }),
});
