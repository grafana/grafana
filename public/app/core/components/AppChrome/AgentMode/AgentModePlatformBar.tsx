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

export function AgentModePlatformBar() {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const styles = useStyles2(getStyles);
  const homeNav = useSelector((s) => s.navIndex)[HOME_NAV_ID];
  const breadcrumbs = buildBreadcrumbs(state.sectionNav.node, state.pageNav, homeNav);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <div className={styles.bar}>
        <ToolbarButton
          narrow
          icon="bars"
          tooltip={t('navigation.megamenu.open', 'Main menu')}
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
  backdrop: css({
    position: 'absolute',
    top: 'var(--agent-platform-top-offset, 0)',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: theme.zIndex.modalBackdrop,
    background: theme.components.overlay.background,
  }),
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
