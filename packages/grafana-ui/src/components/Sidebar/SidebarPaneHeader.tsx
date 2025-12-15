import { css, cx } from '@emotion/css';
import { ReactNode, useContext } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';
import { Text } from '../Text/Text';

import { SidebarContext } from './useSidebar';

export interface Props {
  children?: ReactNode;
  title: string;
}

export function SidebarPaneHeader({ children, title }: Props) {
  const styles = useStyles2(getStyles);
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('SidebarPaneHeader must be used within a Sidebar');
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>
        <Text weight="medium" variant="h6" truncate data-testid="sidebar-pane-header-title">
          {title}
        </Text>
        <div className={styles.flexGrow} />
        <IconButton
          name="web-section-alt"
          size="md"
          variant="secondary"
          onClick={context.onToggleDock}
          aria-label={
            context.isDocked ? t('grafana-ui.sidebar.undock', 'Undock') : t('grafana-ui.sidebar.dock', 'Dock')
          }
          tooltip={context.isDocked ? t('grafana-ui.sidebar.undock', 'Undock') : t('grafana-ui.sidebar.dock', 'Dock')}
          data-testid={selectors.components.Sidebar.dockToggle}
          className={cx(styles.dock, context.isDocked && 'active')}
        />
        {context.onClosePane && (
          <IconButton
            variant="secondary"
            size="lg"
            name="times"
            onClick={context.onClosePane}
            aria-label={t('grafana-ui.sidebar.close', 'Close')}
            tooltip={t('grafana-ui.sidebar.close', 'Close')}
            data-testid={selectors.components.Sidebar.closePane}
          />
        )}
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    title: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1.5),
      height: theme.spacing(6),
      gap: theme.spacing(0.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    flexGrow: css({
      flexGrow: 1,
    }),
    actions: css({
      padding: theme.spacing(1.5),
      height: theme.spacing(6),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    dock: css({
      opacity: 0.6,
      padding: theme.spacing(0.5),
      '&.active': {
        opacity: 1,
        backgroundColor: theme.colors.background.secondary,
        boxShadow: `inset 0 1px 0 ${theme.colors.border.weak}, inset 0 -2px 6px ${theme.colors.border.medium}`,
      },
    }),
  };
};
