import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';
import { Text } from '../Text/Text';

export interface Props {
  children?: ReactNode;
  title: string;
  onClose?: () => void;
}

export function SidebarPaneHeader({ children, onClose, title }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {onClose && (
        <IconButton
          variant="secondary"
          size="lg"
          name="times"
          onClick={onClose}
          aria-label={t('grafana-ui.sidebar.close', 'Close')}
          tooltip={t('grafana-ui.sidebar.close', 'Close')}
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
