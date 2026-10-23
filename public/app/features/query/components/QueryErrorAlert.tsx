import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  OpenAssistantButton,
  createAssistantContextItem,
  useAssistant,
  useProvidePageContext,
} from '@grafana/assistant';
import {
  type DataQueryError,
  type DataSourceInstanceSettings,
  type GrafanaTheme2,
  PluginExtensionPoints,
  type PluginExtensionQueryErrorActionV1Context,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { usePluginComponents } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  error: DataQueryError;
  query?: DataQuery;
  dataSource?: DataSourceInstanceSettings;
  app?: string;
}

export function QueryErrorAlert({ error, query, dataSource, app }: Props) {
  const styles = useStyles2(getStyles);
  const { isAvailable } = useAssistant();

  const message = error?.message ?? error?.data?.message ?? 'Query error';

  const context = useMemo(() => buildAssistantContext(error, message, query), [error, message, query]);
  useProvidePageContext(/\/explore.*/, context);

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
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
              title={t('query.query-error-alert.fix-with-assistant', 'Fix with Assistant')}
              size="sm"
            />
          </div>
        )}
      </div>
      <QueryErrorActions error={error} query={query} dataSource={dataSource} app={app} />
    </div>
  );
}

function QueryErrorActions({ error, query, dataSource, app }: Props) {
  const styles = useStyles2(getStyles);
  const { isLoading, components } = usePluginComponents<PluginExtensionQueryErrorActionV1Context>({
    extensionPointId: PluginExtensionPoints.QueryErrorAction,
    limitPerPlugin: 1,
  });

  if (isLoading || !components.length) {
    return null;
  }

  const context: PluginExtensionQueryErrorActionV1Context = {
    error,
    query,
    dataSource: dataSource ? { uid: dataSource.uid, type: dataSource.type, name: dataSource.name } : undefined,
    app,
  };

  return (
    <div className={styles.actions}>
      {components.map((Component) => (
        <Component key={Component.meta.id} {...context} />
      ))}
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
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
  }),
  actions: css({
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1, 1),
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
    // A datasource error often carries the request URL, which holds no spaces to break at. Its
    // min-content width is then the whole string, and a flex item never shrinks below that, so the
    // row grew wider than the page. `anywhere` lets the text break mid-word and drops that minimum.
    minWidth: 0,
    overflowWrap: 'anywhere',
  }),
  assistantButton: css({
    padding: theme.spacing(0, 1),
  }),
});
