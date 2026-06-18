import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types/store';

import { Breadcrumbs } from '../../Breadcrumbs/Breadcrumbs';
import { buildBreadcrumbs } from '../../Breadcrumbs/utils';

/**
 * Slim bar rendered at the top of the agent-mode Platform tab (portaled in by AppChrome
 * above the live page). Gives the Platform view Grafana's hamburger + breadcrumbs, so the
 * user can open the mega menu and navigate without leaving agent mode. The mega menu
 * overlay itself is rendered by AgentModeShell (gated on the same `megaMenuOpen` state).
 */
export function AgentModePlatformBar() {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const styles = useStyles2(getStyles);
  const homeNav = useSelector((s) => s.navIndex)[HOME_NAV_ID];
  const breadcrumbs = buildBreadcrumbs(state.sectionNav.node, state.pageNav, homeNav);

  return (
    <div className={styles.bar}>
      <ToolbarButton
        narrow
        icon="bars"
        tooltip={t('navigation.megamenu.open', 'Open menu')}
        aria-expanded={state.megaMenuOpen}
        onClick={() => chrome.setMegaMenuOpen(!state.megaMenuOpen)}
      />
      <Breadcrumbs breadcrumbs={breadcrumbs} className={styles.breadcrumbs} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    background: theme.colors.background.primary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  breadcrumbs: css({
    display: 'flex',
    overflow: 'hidden',
  }),
});
