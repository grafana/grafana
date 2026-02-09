import { css } from '@emotion/css';

import { OpenAssistantButton, createAssistantContextItem, useAssistant } from '@grafana/assistant';
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
  const { isAvailable } = useAssistant();

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
      {isAvailable && (
        <div className={styles.assistantButton}>
        <OpenAssistantButton
          origin="grafana/query-editor-error"
          prompt={`Help me analyze and fix the following ${error.type ? `\`${error.type}\`` : ''} query error: \`\`\`${message}\`\`\``}
          context={buildAssistantContext(error, message, query)}
          title={t('query.query-error-alert.fix-with-assistant', 'Fix with Assistant')}
          size="sm"
          />
        </div>
      )}
    </div>
  );
}

function buildAssistantContext(error: DataQueryError, message: string, query?: DataQuery) {
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

    if (query.datasource?.uid) {
      context.push(
        createAssistantContextItem('datasource', {
          datasourceUid: query.datasource.uid,
        })
      );
    }
  }

  return context;
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
