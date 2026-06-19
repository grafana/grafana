import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types/store';

import { Breadcrumbs } from '../../Breadcrumbs/Breadcrumbs';
import { buildBreadcrumbs } from '../../Breadcrumbs/utils';
import { MegaMenu, MENU_WIDTH } from '../MegaMenu/MegaMenu';

/**
 * Slim bar rendered at the top of the agent-mode Platform tab (portaled in by AppChrome
 * above the live page). Gives the Platform view Grafana's hamburger + breadcrumbs, so the
 * user can open the mega menu and navigate without leaving agent mode.
 *
 * The mega menu drawer is rendered here too, positioned `absolute` so it stays scoped to
 * the Platform tab (the plugin's canvas card is `position: relative` + `overflow: hidden`)
 * rather than a viewport-wide drawer that would cover the conversation list and chat.
 */
export function AgentModePlatformBar() {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const styles = useStyles2(getStyles);
  const homeNav = useSelector((s) => s.navIndex)[HOME_NAV_ID];
  const breadcrumbs = buildBreadcrumbs(state.sectionNav.node, state.pageNav, homeNav);

  // The Platform-tab mega menu is local to agent mode: it always starts collapsed and its
  // open/close never touches Grafana's global mega-menu state (megaMenuOpen/Docked), so a
  // menu left open or docked in non-agent Grafana doesn't carry into the Platform tab, and
  // toggling it here doesn't change non-agent Grafana.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <div className={styles.bar}>
        <ToolbarButton
          narrow
          icon="bars"
          tooltip={t('navigation.megamenu.open', 'Open menu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        />
        <Breadcrumbs breadcrumbs={breadcrumbs} className={styles.breadcrumbs} />
      </div>
      {menuOpen && (
        <>
          <div className={styles.backdrop} onClick={closeMenu} role="presentation" />
          <nav className={styles.drawer} aria-label={t('navigation.megamenu.dialog-label', 'Navigation')}>
            <MegaMenu onClose={closeMenu} />
          </nav>
        </>
      )}
    </>
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
  // Scoped to the Platform tab: absolute within the plugin's relative + overflow-hidden
  // canvas card, so the drawer/backdrop cover only the Platform pane (not the chat).
  backdrop: css({
    position: 'absolute',
    // Start below the plugin's canvas tab strip (Platform | Report) — the plugin host
    // exposes its height as --agent-platform-top-offset.
    top: 'var(--agent-platform-top-offset, 0)',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: theme.zIndex.modalBackdrop,
    background: theme.components.overlay.background,
  }),
  // The drawer itself is the scroll container: a definite height (absolute top/bottom)
  // + overflow-y auto, so MegaMenu's natural content height scrolls within it. (MegaMenu's
  // own height:100% ScrollContainer doesn't bound in this portaled/absolute context.)
  drawer: css({
    position: 'absolute',
    top: 'var(--agent-platform-top-offset, 0)',
    bottom: 0,
    left: 0,
    width: MENU_WIDTH,
    maxWidth: '100%',
    zIndex: theme.zIndex.modal,
    overflowY: 'auto',
    overflowX: 'hidden',
    background: theme.colors.background.primary,
    borderRight: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
  }),
});
