import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2, Text, Box } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { TOP_BAR_LEVEL_HEIGHT } from '../types';

import { HistoryWrapper } from './HistoryWrapper';

const MENU_WIDTH = '300px';
const DOCK_HISTORY_BUTTON_ID = 'dock-history-button';
const HISTORY_HEADER_TOGGLE_ID = 'history-header-toggle';

export const HistoryDrawer = ({ onClose }: { onClose: () => void }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.drawer}>
      <MegaMenuHeader onClose={onClose} />
      <HistoryWrapper onClose={onClose} />
    </div>
  );
};

export const MegaMenuHeader = ({ onClose }: { onClose: () => void }) => {
  const styles = useStyles2(getStyles);
  const [docked, setDocked] = useState(false);
  const handleMegaMenu = () => {
    onClose();
  };

  const handleDockedMenu = () => {
    setDocked(!docked);
  };

  return (
    <div className={styles.header}>
      <Text element="h6">{t('nav.history-container.drawer-tittle', 'History')}</Text>
      <Box justifyContent={'center'} display={'flex'}>
        <IconButton
          id={DOCK_HISTORY_BUTTON_ID}
          tooltip={docked ? t('navigation.megamenu.undock', 'Undock') : t('navigation.megamenu.dock', 'Dock')}
          name="web-section-alt"
          onClick={handleDockedMenu}
          variant="secondary"
        />
        <IconButton
          id={HISTORY_HEADER_TOGGLE_ID}
          tooltip={t('navigation.megamenu.close', 'Close')}
          name="times"
          onClick={handleMegaMenu}
          size="xl"
          variant="secondary"
        />
      </Box>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    drawer: css({
      width: MENU_WIDTH,
      height: `calc(100vh - ${TOP_BAR_LEVEL_HEIGHT}px)`,
      overflowY: 'auto',
      overflowX: 'hidden',
      background: theme.colors.background.secondary,
      borderLeft: `1px solid ${theme.colors.border.medium}`,
      boxShadow: theme.shadows.z2,
      zIndex: theme.zIndex.sidemenu,
      position: 'fixed',
      top: TOP_BAR_LEVEL_HEIGHT,
      right: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
    }),
    header: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
      justifyContent: 'space-between',
      paddingBottom: theme.spacing(2),
      height: TOP_BAR_LEVEL_HEIGHT,
      minHeight: TOP_BAR_LEVEL_HEIGHT,
    }),
  };
};
