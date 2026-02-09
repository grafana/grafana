import { css } from '@emotion/css';

import { OpenAssistantButton, createAssistantContextItem } from '@grafana/assistant';
import { DataQueryError, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  error: DataQueryError;
  query?: DataQuery;
}

export function QueryErrorAlert({ error, query }: Props) {
  const styles = useStyles2(getStyles);

  const message = error?.message ?? error?.data?.message ?? 'Query error';

  const context = [
    createAssistantContextItem('structured', {
      title: t('query.query-error-alert.error-details', 'Query error details'),
      data: {
        type: error.type,
        message,
      },
    }),
  ];

  if (query) {
    context.push(
      createAssistantContextItem('structured', {
        title: t('query.query-error-alert.original-query', 'Original query'),
        data: query,
      })
    );
  }

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
      <div className={styles.assistantButton}>
        <OpenAssistantButton
          origin="grafana/query-editor-error"
          prompt={`Explain the following query error and help me fix it.\n\nError: ${message}${error.type ? `\nError type: \`${error.type}\`` : ''}`}
          context={context}
          title={t('query.query-error-alert.explain-in-assistant', 'Explain in Assistant')}
          size="sm"
        />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginTop: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    display: 'flex',
    alignItems: 'center',
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
    flex: 1,
  }),
  assistantButton: css({
    padding: theme.spacing(0, 1),
  }),
});
