import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

export interface PanelEmptyStateProps {
  content?: React.ReactNode;
  type?: 'panel' | 'suggestions';
  className?: string;
}

export function PanelEmptyState({ content, type = 'panel', className }: PanelEmptyStateProps) {
  const styles = useStyles2(getStyles);
  const wrapperClass = type === 'panel' ? styles.panelWrapper : styles.suggestionsWrapper;

  // @TODO: Add link
  const defaultContent = (
    <Trans i18nKey="dashboard.new-panel.empty-state-message">
      Run a query to visualize it here or go to all visualizations to add other panel types
    </Trans>
  );

  return (
    <div className={`${wrapperClass} ${className || ''}`}>
      <Icon name="chart-line" size="xxxl" className={styles.emptyStateIcon} />
      <Text element="p" textAlignment="center" color="secondary">
        {content || defaultContent}
      </Text>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panelWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  suggestionsWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    textAlign: 'center',
    minHeight: '200px',
  }),
  emptyStateIcon: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(2),
  }),
});
