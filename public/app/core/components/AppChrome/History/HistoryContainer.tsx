import { css } from '@emotion/css';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Drawer, ToolbarButton, useStyles2 } from '@grafana/ui';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { HistoryWrapper } from './HistoryWrapper';

export function HistoryContainer() {
  const [showHistoryDrawer, onToggleShowHistoryDrawer] = useToggle(true);
  const styles = useStyles2(getStyles);

  return (
    <>
      <ToolbarButton onClick={onToggleShowHistoryDrawer} iconOnly icon="history" aria-label="History" />
      <NavToolbarSeparator className={styles.separator} />
      {showHistoryDrawer && (
        <Drawer title="History" onClose={onToggleShowHistoryDrawer} size="md">
          <HistoryWrapper />
        </Drawer>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    separator: css({
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    }),
  };
};
