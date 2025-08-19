import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, ToolbarButton, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { Branding } from '../../Branding/Branding';
import { OrganizationSwitcher } from '../OrganizationSwitcher/OrganizationSwitcher';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

export interface Props {
  handleMegaMenu: () => void;
  handleDockedMenu: () => void;
  onClose: () => void;
}

export const DOCK_MENU_BUTTON_ID = 'dock-menu-button';
export const MEGA_MENU_HEADER_TOGGLE_ID = 'mega-menu-header-toggle';

export function MegaMenuHeader({ handleMegaMenu, handleDockedMenu, onClose }: Props) {
  const theme = useTheme2();
  const { chrome } = useGrafana();
  const state = chrome.useState();

  const styles = getStyles(theme);

  return (
    <div className={styles.header}>
      <Stack alignItems="center" minWidth={0} gap={0.25}>
        <ToolbarButton
          narrow
          id={MEGA_MENU_HEADER_TOGGLE_ID}
          onClick={handleMegaMenu}
          tooltip={t('navigation.megamenu.close', 'Close menu')}
        >
          <Branding.MenuLogo className={styles.img} />
        </ToolbarButton>
        <OrganizationSwitcher />
      </Stack>
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
        variant="secondary"
      />
      <IconButton
        className={styles.mobileCloseButton}
        tooltip={t('navigation.megamenu.close', 'Close menu')}
        name="times"
        onClick={onClose}
        size="xl"
        variant="secondary"
      />
    </div>
  );
}

MegaMenuHeader.displayName = 'MegaMenuHeader';

const getStyles = (theme: GrafanaTheme2) => ({
  dockMenuButton: css({
    display: 'none',

    [theme.breakpoints.up('xl')]: {
      display: 'inline-flex',
    },
  }),
  header: css({
    alignItems: 'center',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    padding: theme.spacing(0, 1, 0, 0.75),
    height: getChromeHeaderLevelHeight(),
    flexShrink: 0,
  }),
  img: css({
    alignSelf: 'center',
    height: theme.spacing(3),
    width: theme.spacing(3),
  }),
  mobileCloseButton: css({
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  }),
});
