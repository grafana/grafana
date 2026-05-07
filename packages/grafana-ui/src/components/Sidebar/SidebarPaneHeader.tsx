import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';
import { Text } from '../Text/Text';

import { useSidebarContext } from './useSidebar';

export interface Props {
  children?: ReactNode;
  title: string;
}

export function SidebarPaneHeader({ children, title }: Props) {
  const styles = useStyles2(getStyles);
  const sidebarContext = useSidebarContext();

  if (!sidebarContext) {
    throw new Error('SidebarPaneHeader must be used within a Sidebar');
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        {sidebarContext.onGoBack && (
          <IconButton
            variant="secondary"
            size="lg"
            name="arrow-left"
            onClick={sidebarContext.onGoBack}
            disabled={!sidebarContext.canGoBack}
            aria-label={t('grafana-ui.sidebar.go-back', 'Go back')}
            tooltip={t('grafana-ui.sidebar.go-back', 'Go back')}
            data-testid={selectors.components.Sidebar.goBack}
          />
        )}
        <Text weight="medium" variant="h6" truncate data-testid={selectors.components.Sidebar.headerTitle}>
          {title}
        </Text>
        <div className={styles.flexGrow} />
        {sidebarContext.onToggleDock && (
          <IconButton
            name={'web-section-alt'}
            onClick={sidebarContext.onToggleDock}
            className={sidebarContext.isDocked ? undefined : styles.dockedButtonUndocked}
            tooltip={
              sidebarContext.isDocked ? t('grafana-ui.sidebar.undock', 'Undock') : t('grafana-ui.sidebar.dock', 'Dock')
            }
            data-testid={selectors.components.Sidebar.dockToggle}
          />
        )}
        {sidebarContext.onClosePane && (
          <IconButton
            variant="secondary"
            size="lg"
            name="times"
            onClick={sidebarContext.onClosePane}
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
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1.5, 1, 1.5, 1.5),
      gap: theme.spacing(1),
    }),
    flexGrow: css({
      flexGrow: 1,
    }),
    actions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 1.5, 1),
      '&:empty': {
        display: 'none',
      },
    }),
    dockedButtonUndocked: css({
      opacity: 0.6,
    }),
  };
};
