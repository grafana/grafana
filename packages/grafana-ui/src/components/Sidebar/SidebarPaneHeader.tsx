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
  onGoBack?: () => void;
}

export function SidebarPaneHeader({ children, title, onGoBack }: Props) {
  const styles = useStyles2(getStyles);
  const sidebarContext = useSidebarContext();

  if (!sidebarContext) {
    throw new Error('SidebarPaneHeader must be used within a Sidebar');
  }

  return (
    <div className={styles.wrapper}>
      {onGoBack && (
        <IconButton
          variant="secondary"
          size="lg"
          name="arrow-left"
          onClick={onGoBack}
          aria-label={t('grafana-ui.sidebar.go-back', 'Go back')}
          tooltip={t('grafana-ui.sidebar.go-back', 'Go back')}
          data-testid={selectors.components.Sidebar.goBack}
        />
      )}
      {!onGoBack && sidebarContext.onClosePane && (
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
      <Text weight="medium" variant="h6" truncate data-testid="sidebar-pane-header-title">
        {title}
      </Text>
      {children}
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1.5),
      height: theme.spacing(6),
      gap: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    flexGrow: css({
      flexGrow: 1,
    }),
  };
};
