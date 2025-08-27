import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

interface ErrorMessageRowProps {
  message: string;
}

export function ErrorMessageRow({ message }: ErrorMessageRowProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.errorRow} data-testid="state-history-error">
      <div className={styles.errorContainer}>
        <Text variant="bodySmall" truncate element="p">
          <strong>{t('alerting.state-history.error-message-prefix', 'Error message:')}</strong> {message}
        </Text>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  errorRow: css({
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.5),
    display: 'block',
  }),
  errorContainer: css({
    display: 'flex',
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
    gap: theme.spacing(2),
  }),
});
