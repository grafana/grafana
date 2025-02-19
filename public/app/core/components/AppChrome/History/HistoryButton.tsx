import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { t } from 'app/core/internationalization';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

export function HistoryButton() {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const showHistoryDrawer = state.historyOpen;
  const styles = useStyles2(getStyles);

  return (
    <>
      <ToolbarButton
        onClick={() => chrome.setHistoryOpen(!showHistoryDrawer)}
        iconOnly
        icon="history"
        aria-label={t('nav.history-container.drawer-tittle', 'History')}
      />
      <NavToolbarSeparator className={styles.separator} />
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
