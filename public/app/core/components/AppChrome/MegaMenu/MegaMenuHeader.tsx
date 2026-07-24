import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useHomeNav } from 'app/core/hooks/useHomeNav';

import { HomeLogo, HomeTitle } from '../../Branding/Branding';
import { OrganizationSwitcher } from '../OrganizationSwitcher/OrganizationSwitcher';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

export interface Props {
  handleDockedMenu: () => void;
  onClose: () => void;
}

export const DOCK_MENU_BUTTON_ID = 'dock-menu-button';
export const MEGA_MENU_HEADER_TOGGLE_ID = 'mega-menu-header-toggle';

export function MegaMenuHeader({ handleDockedMenu, onClose }: Props) {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const homeNav = useHomeNav();
  const styles = useStyles2(getStyles, visualRefreshEnabled);

  // While customising the nav, lock the header so the user can only pin/hide/reorder or finish editing:
  // home navigation, docking and closing are all disabled until they leave customise mode.
  const customising = state.megaMenuCustomising ?? false;

  return (
    <div className={styles.header}>
      <Stack alignItems="center" minWidth={0} gap={1}>
        <div className={cx(customising && styles.disabled)}>
          <HomeLogo homeNav={homeNav} onClick={state.megaMenuDocked ? undefined : onClose} />
        </div>
        {/* Wrap the switcher itself, not its child: with multiple orgs it renders a dropdown instead of
            the passed HomeTitle, so this is what disables the org dropdown while customising. */}
        <div className={cx(customising && styles.disabled)}>
          <OrganizationSwitcher>
            <HomeTitle homeNav={homeNav} onClick={state.megaMenuDocked ? undefined : onClose} />
          </OrganizationSwitcher>
        </div>
      </Stack>
      <div className={styles.flexGrow} />
      {/* Docking is intentionally not allowed in fullscreen workspace */}
      {!state.fullscreenWorkspace && (
        <IconButton
          id={DOCK_MENU_BUTTON_ID}
          className={styles.dockMenuButton}
          tooltip={
            state.megaMenuDocked
              ? t('navigation.megamenu.undock', 'Undock menu')
              : t('navigation.megamenu.dock', 'Dock menu')
          }
          name="web-section-alt"
          onClick={handleDockedMenu}
          disabled={customising}
          variant="secondary"
        />
      )}
      <IconButton
        aria-label={t('navigation.megamenu.close', 'Close menu')}
        tooltip={t('navigation.megamenu.close', 'Close menu')}
        name="times"
        onClick={onClose}
        disabled={customising}
        size="lg"
        variant="secondary"
      />
    </div>
  );
}

MegaMenuHeader.displayName = 'MegaMenuHeader';

const getStyles = (theme: GrafanaTheme2, visualRefreshEnabled: boolean) => ({
  dockMenuButton: css({
    display: 'none',

    [theme.breakpoints.up('xl')]: {
      display: 'inline-flex',
    },
  }),
  header: css({
    alignItems: 'center',
    borderBottom: visualRefreshEnabled ? undefined : `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    padding: theme.spacing(0, 1, 0, 1),
    height: getChromeHeaderLevelHeight(),
    flexShrink: 0,
  }),
  flexGrow: css({ flexGrow: 1 }),
  // Non-interactive (and visibly muted) while customising, without removing the element from layout.
  disabled: css({
    opacity: 0.5,
    pointerEvents: 'none',
  }),
});
