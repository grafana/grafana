import { css } from '@emotion/css';

import { DataQueryError, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  error: DataQueryError;
}

export function QueryErrorAlert({ error }: Props) {
  const styles = useStyles2(getStyles);

  const message = error?.message ?? error?.data?.message ?? 'Query error';

  return (
    <div className={styles.wrapper}>
      <div className={styles.icon}>
        <Icon name="exclamation-triangle" />
      </div>
      <div className={styles.message}>
        {message}
        {error.traceId != null && (
          <>
            <br />{' '}
            <span>
              <Trans i18nKey="query.query-error-alert.trace-id" values={{ traceId: error.traceId }}>
                (Trace ID: {'{{traceId}}'})
              </Trans>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginTop: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    display: 'flex',
  }),
  icon: css({
    background: theme.colors.error.main,
    color: theme.colors.error.contrastText,
    padding: theme.spacing(1),
  }),
  message: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    padding: theme.spacing(1),
  }),
});
