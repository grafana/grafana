import { css } from '@emotion/css';
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
      <Text weight="medium" variant="h6" truncate data-testid="sidebar-pane-header-title">
        {title}
      </Text>
      <div className={styles.flexGrow} />
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
