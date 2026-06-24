import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types/store';

import { HomeLink } from '../../Branding/Branding';
import { OrganizationSwitcher } from '../OrganizationSwitcher/OrganizationSwitcher';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

import { MegaMenuCustomiseControls } from './MegaMenuCustomiseControls';

export interface Props {
  handleDockedMenu: () => void;
  onClose: () => void;
  /** Customisation is available — show the "Customise menu" entry point */
  canCustomise?: boolean;
  /** The menu is in customise (edit) mode — show the Reset/Cancel/Done controls instead */
  editMode?: boolean;
  /** There is staged customisation to clear — show the Reset control */
  canReset?: boolean;
  /** Enter customise mode */
  onEnterEditMode?: () => void;
  /** Save the staged customisation and leave customise mode */
  onSaveEdit?: () => void;
  /** Discard the staged customisation and leave customise mode */
  onCancelEdit?: () => void;
  /** Stage a reset of all customisation back to defaults */
  onResetToDefault?: () => void;
}

export const DOCK_MENU_BUTTON_ID = 'dock-menu-button';
export const MEGA_MENU_HEADER_TOGGLE_ID = 'mega-menu-header-toggle';
const CUSTOMISE_MENU_BUTTON_ID = 'customise-menu-button';

export function MegaMenuHeader({
  handleDockedMenu,
  onClose,
  canCustomise,
  editMode,
  canReset,
  onEnterEditMode,
  onSaveEdit,
  onCancelEdit,
  onResetToDefault,
}: Props) {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const homeNav = useSelector((state) => state.navIndex)[HOME_NAV_ID];
  const styles = useStyles2(getStyles, visualRefreshEnabled);

  return (
    <div className={styles.header}>
      <Stack alignItems="center" minWidth={0} gap={1}>
        <HomeLink homeNav={homeNav} onClick={state.megaMenuDocked ? undefined : onClose} />
        {/* The org switcher's auto-width control would overflow alongside the wider edit-mode
            controls (Reset/Cancel/Done), so hide it while customising. */}
        {!editMode && <OrganizationSwitcher />}
      </Stack>
      <div className={styles.flexGrow} />
      {editMode ? (
        <MegaMenuCustomiseControls
          canReset={canReset}
          onResetToDefault={onResetToDefault}
          onCancelEdit={onCancelEdit}
          onSaveEdit={onSaveEdit}
        />
      ) : (
        <>
          {canCustomise && (
            <IconButton
              id={CUSTOMISE_MENU_BUTTON_ID}
              tooltip={t('navigation.megamenu.customise', 'Customise menu')}
              name="sliders-v-alt"
              onClick={onEnterEditMode}
              variant="secondary"
            />
          )}
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
            aria-label={t('navigation.megamenu.close', 'Close menu')}
            tooltip={t('navigation.megamenu.close', 'Close menu')}
            name="times"
            onClick={onClose}
            size="lg"
            variant="secondary"
          />
        </>
      )}
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
});
