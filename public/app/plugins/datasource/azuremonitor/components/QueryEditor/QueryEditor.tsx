import { debounce } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { CoreApp, QueryEditorProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, CodeEditor, Space, TextLink } from '@grafana/ui';

import AzureMonitorDatasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { AzureMonitorQuery, AzureQueryType } from '../../types/query';
import { AzureMonitorDataSourceJsonData, AzureMonitorErrorish, AzureMonitorOption } from '../../types/types';
import useLastError from '../../utils/useLastError';
import ArgQueryEditor from '../ArgQueryEditor';
import LogsQueryEditor from '../LogsQueryEditor';
import { AzureCheatSheetModal } from '../LogsQueryEditor/AzureCheatSheetModal';
import NewMetricsQueryEditor from '../MetricsQueryEditor/MetricsQueryEditor';
import TracesQueryEditor from '../TracesQueryEditor';

import { QueryHeader } from './QueryHeader';
import usePreparedQuery from './usePreparedQuery';

export type AzureMonitorQueryEditorProps = QueryEditorProps<
  AzureMonitorDatasource,
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData
>;

const QueryEditor = ({
  app,
  query: baseQuery,
  datasource,
  onChange,
  onRunQuery: baseOnRunQuery,
  data,
  range,
}: AzureMonitorQueryEditorProps) => {
  const [errorMessage, setError] = useLastError();
  const onRunQuery = useMemo(() => debounce(baseOnRunQuery, 500), [baseOnRunQuery]);
  const [azureLogsCheatSheetModalOpen, setAzureLogsCheatSheetModalOpen] = useState(false);
  const [defaultSubscriptionId, setDefaultSubscriptionId] = useState('');

  const onQueryChange = useCallback(
    (newQuery: AzureMonitorQuery) => {
      onChange(newQuery);
      onRunQuery();
    },
    [onChange, onRunQuery]
  );

  useEffectOnce(() => {
    if (baseQuery.queryType === AzureQueryType.TraceExemplar) {
      datasource.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription().then((subscription) => {
        setDefaultSubscriptionId(subscription || '');
      });
    }
  });

  const query = usePreparedQuery(baseQuery, onQueryChange, defaultSubscriptionId);

  const subscriptionId = query.subscription || datasource.azureMonitorDatasource.defaultSubscriptionId;
  const basicLogsEnabled =
    datasource.azureMonitorDatasource.basicLogsEnabled &&
    app !== CoreApp.UnifiedAlerting &&
    app !== CoreApp.CloudAlerting;
  const variableOptionGroup = {
    label: 'Template Variables',
    options: datasource.getVariables().map((v) => ({ label: v, value: v })),
  };

  // Allow authproxy as it may not be clear if an authproxy user is authenticated by Azure
  const isAzureAuthenticated =
    config.bootData.user.authenticatedBy === 'oauth_azuread' || config.bootData.user.authenticatedBy === 'authproxy';
  if (datasource.currentUserAuth) {
    if (
      app === CoreApp.UnifiedAlerting &&
      (!config.azure.userIdentityFallbackCredentialsEnabled || !datasource.currentUserAuthFallbackAvailable)
    ) {
      return <UserAuthFallbackAlert />;
    }
    if (!isAzureAuthenticated) {
      return <UserAuthAlert />;
    }
  }

  return (
    <div data-testid="azure-monitor-query-editor">
      <AzureCheatSheetModal
        datasource={datasource.azureLogAnalyticsDatasource}
        isOpen={azureLogsCheatSheetModalOpen}
        onClose={() => setAzureLogsCheatSheetModalOpen(false)}
        onChange={(a) => onChange({ ...a, queryType: AzureQueryType.LogAnalytics })}
      />
      <QueryHeader
        query={query}
        onQueryChange={onQueryChange}
        setAzureLogsCheatSheetModalOpen={setAzureLogsCheatSheetModalOpen}
        onRunQuery={baseOnRunQuery}
        data={data}
        app={app}
      />
      <EditorForQueryType
        data={data}
        subscriptionId={subscriptionId}
        basicLogsEnabled={basicLogsEnabled ?? false}
        query={query}
        datasource={datasource}
        onChange={onQueryChange}
        onQueryChange={onChange}
        variableOptionGroup={variableOptionGroup}
        setError={setError}
        range={range}
      />
      {errorMessage && (
        <>
          <Space v={2} />
          <Alert
            severity="error"
            title={t(
              'components.query-editor.alert-error-occurred',
              'An error occurred while requesting metadata from Azure Monitor'
            )}
          >
            {errorMessage instanceof Error ? errorMessage.message : errorMessage}
          </Alert>
        </>
      )}
    </div>
  );
};

interface EditorForQueryTypeProps extends Omit<AzureMonitorQueryEditorProps, 'onRunQuery'> {
  subscriptionId?: string;
  basicLogsEnabled: boolean;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
  // Used to update the query without running it
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const EditorForQueryType = ({
  data,
  subscriptionId,
  basicLogsEnabled,
  query,
  datasource,
  variableOptionGroup,
  onChange,
  setError,
  onQueryChange,
  range,
}: EditorForQueryTypeProps) => {
  switch (query.queryType) {
    case AzureQueryType.AzureMonitor:
      return (
        <NewMetricsQueryEditor
          data={data}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
        />
      );

    case AzureQueryType.LogAnalytics:
      return (
        <LogsQueryEditor
          data={data}
          subscriptionId={subscriptionId}
          basicLogsEnabled={basicLogsEnabled}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
          timeRange={range}
          onQueryChange={onQueryChange}
        />
      );

    case AzureQueryType.AzureResourceGraph:
      return (
        <ArgQueryEditor
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
        />
      );

    case AzureQueryType.AzureTraces:
    case AzureQueryType.TraceExemplar:
      return (
        <TracesQueryEditor
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
          range={range}
        />
      );

    default:
      const type = query.queryType as unknown;
      return (
        <Alert title={t('components.editor-for-query-type.title-unknown-query-type', 'Unknown query type')}>
          {(type === 'Application Insights' || type === 'Insights Analytics') && (
            <>
              <Trans i18nKey="components.editor-for-query-type.body-unknown-query-type">
                {{ type }} was deprecated in Grafana 9. See the{' '}
                <TextLink
                  href="https://grafana.com/docs/grafana/latest/datasources/azure-monitor/#application-insights-and-insights-analytics-removed"
                  external
                >
                  deprecation notice
                </TextLink>{' '}
                to get more information about how to migrate your queries. This is the current query definition:
              </Trans>
              <CodeEditor height="200px" readOnly language="json" value={JSON.stringify(query, null, 4)} />
            </>
          )}
        </Alert>
      );
  }
};

const UserAuthAlert = () => {
  return (
    <Alert
      title={t('components.user-auth-alert.title-unsupported-auth', 'Unsupported authentication provider')}
      data-testid={selectors.components.queryEditor.userAuthAlert}
    >
      <Trans i18nKey="components.user-auth-alert.body-unsupported-auth">
        Usage of this data source requires you to be authenticated via Azure Entra (formerly Azure Active Directory).
        Please review the{' '}
        <TextLink
          href="https://grafana.com/docs/grafana/latest/datasources/azure-monitor/#configure-current-user-authentication"
          external
        >
          documentation
        </TextLink>{' '}
        for more information.
      </Trans>
    </Alert>
  );
};

const UserAuthFallbackAlert = () => {
  return (
    <Alert
      title={t(
        'components.user-auth-fallback-alert.title-no-fallback-credentials',
        'No fallback credentials available'
      )}
      data-testid={selectors.components.queryEditor.userAuthFallbackAlert}
    >
      <Trans i18nKey="components.user-auth-fallback-alert.body-no-fallback-credentials">
        Data source backend features (such as alerting) require service credentials to function. This data source is
        configured without service credential fallback, or the fallback functionality is disabled. Please review the{' '}
        <TextLink
          href="https://grafana.com/docs/grafana/latest/datasources/azure-monitor/#configure-current-user-authentication"
          external
        >
          documentation
        </TextLink>{' '}
        for more information.
      </Trans>
    </Alert>
  );
};

export default QueryEditor;
