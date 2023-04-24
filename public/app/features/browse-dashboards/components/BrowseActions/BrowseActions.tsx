import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';

export interface Props {}

export function BrowseActions() {
  const styles = useStyles2(getStyles);

  const onMove = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: MoveModal,
      })
    );
  };

  const onDelete = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: DeleteModal,
      })
    );
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
