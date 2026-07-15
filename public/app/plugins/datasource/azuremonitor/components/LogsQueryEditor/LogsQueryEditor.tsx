import { useEffect, useState } from 'react';

import { type PanelData, type TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { config, getTemplateSrv } from '@grafana/runtime';
import { Alert, Button, LinkButton, Space, Stack, Text, TextLink } from '@grafana/ui';

import { LogsEditorMode, ResultFormat } from '../../dataquery.gen';
import type Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { type AzureLogAnalyticsMetadataTable } from '../../types/logAnalyticsMetadata';
import { type AzureMonitorQuery } from '../../types/query';
import { type AzureMonitorErrorish, type AzureMonitorOption, type EngineSchema } from '../../types/types';
import { LogsQueryBuilder } from '../LogsQueryBuilder/LogsQueryBuilder';
import { type TierAutoSwitchInfo } from '../LogsQueryBuilder/TableSection';
import ResourceField from '../ResourceField/ResourceField';
import { type ResourceRow, type ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';
import FormatAsField from '../shared/FormatAsField';

import AdvancedResourcePicker from './AdvancedResourcePicker';
import { LogsManagement } from './LogsManagement';
import QueryField from './QueryField';
import { TimeManagement } from './TimeManagement';
import { onLoad, setFormatAs, setKustoQuery, setLogTier } from './setQueryValue';
import useMigrations from './useMigrations';
import { getSelectedLogTier, shouldShowBasicLogsToggle } from './utils';

interface LogsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  basicLogsEnabled: boolean;
  auxiliaryLogsEnabled?: boolean;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
  hideFormatAs?: boolean;
  timeRange?: TimeRange;
  data?: PanelData;
}

const LogsQueryEditor = ({
  query,
  datasource,
  basicLogsEnabled,
  auxiliaryLogsEnabled = false,
  subscriptionId,
  variableOptionGroup,
  onChange,
  onQueryChange,
  setError,
  hideFormatAs,
  timeRange,
  data,
}: LogsQueryEditorProps) => {
  const migrationError = useMigrations(datasource, query, onChange);
  const searchLogsEnabled = basicLogsEnabled || auxiliaryLogsEnabled;
  const [showBasicLogsToggle, setShowBasicLogsToggle] = useState<boolean>(
    shouldShowBasicLogsToggle(query.azureLogAnalytics?.resources || [], searchLogsEnabled)
  );
  const [dataIngestedWarning, setDataIngestedWarning] = useState<React.ReactNode | null>(null);
  const [tierAutoSwitchNotice, setTierAutoSwitchNotice] = useState<TierAutoSwitchInfo | null>(null);
  const templateSrv = getTemplateSrv();
  const from = templateSrv?.replace('$__from');
  const to = templateSrv?.replace('$__to');
  const templateVariableOptions = templateSrv.getVariables();
  const isBasicLogsQuery = (searchLogsEnabled && query.azureLogAnalytics?.basicLogsQuery) ?? false;
  const selectedTier = getSelectedLogTier(query);
  const [isLoadingSchema, setIsLoadingSchema] = useState<boolean>(false);

  const disableRow = (row: ResourceRow, selectedRows: ResourceRowGroup) => {
    if (selectedRows.length === 0) {
      // Only if there is some resource(s) selected we should disable rows
      return false;
    }

    if (isBasicLogsQuery && selectedRows.length === 1) {
      // Basic logs queries can only have one resource selected
      return true;
    }

    const rowResourceNS = parseResourceDetails(row.uri, row.location).metricNamespace?.toLowerCase();
    const selectedRowSampleNs = parseResourceDetails(
      selectedRows[0].uri,
      selectedRows[0].location
    ).metricNamespace?.toLowerCase();
    // Only resources with the same metricNamespace can be selected
    return rowResourceNS !== selectedRowSampleNs;
  };
  const [schema, setSchema] = useState<EngineSchema | undefined>();

  useEffect(() => {
    const resources = query.azureLogAnalytics?.resources;
    if (resources) {
      setIsLoadingSchema(true);
      const fetchAllPlans = async (tables: AzureLogAnalyticsMetadataTable[]) => {
        const promises = [];
        for (const table of tables) {
          promises.push({
            ...table,
            plan: await datasource.azureMonitorDatasource.getWorkspaceTablePlan(resources, table.name),
          });
        }

        const tablesWithPlan = await Promise.all(promises);
        return tablesWithPlan;
      };
      datasource.azureLogAnalyticsDatasource.getKustoSchema(resources[0]).then((schema) => {
        if (schema?.database?.tables && query.azureLogAnalytics?.mode === LogsEditorMode.Builder) {
          fetchAllPlans(schema?.database?.tables).then(async (t) => {
            if (schema.database?.tables) {
              schema.database.tables = t;
            }
          });
        }
        setSchema(schema);
        setIsLoadingSchema(false);
      });
    }
  }, [
    query.azureLogAnalytics?.resources,
    datasource.azureLogAnalyticsDatasource,
    datasource.azureMonitorDatasource,
    query.azureLogAnalytics?.mode,
  ]);

  useEffect(() => {
    if (shouldShowBasicLogsToggle(query.azureLogAnalytics?.resources || [], searchLogsEnabled)) {
      setShowBasicLogsToggle(true);
    } else {
      setShowBasicLogsToggle(false);
    }
  }, [searchLogsEnabled, query.azureLogAnalytics?.resources, templateSrv]);

  useEffect(() => {
    const tier = query.azureLogAnalytics?.logTier;
    const tierStillEnabled =
      (tier === 'Basic' && basicLogsEnabled) || (tier === 'Auxiliary' && auxiliaryLogsEnabled);
    
    // Handle legacy queries: basicLogsQuery: true with no logTier should resolve to an enabled tier
    if (query.azureLogAnalytics?.basicLogsQuery && tier === undefined) {
      // Resolve to first available enabled tier
      const resolvedTier = basicLogsEnabled ? 'Basic' : auxiliaryLogsEnabled ? 'Auxiliary' : undefined;
      if (resolvedTier) {
        const updated = setLogTier(query, resolvedTier);
        onChange(updated);
      } else {
        // No tier is enabled, clear it
        const cleared = setLogTier(query, undefined);
        onChange(cleared);
      }
      return;
    }
    
    const shouldClear =
      (!searchLogsEnabled || !showBasicLogsToggle) && query.azureLogAnalytics?.basicLogsQuery
        ? true
        : !!query.azureLogAnalytics?.basicLogsQuery && tier !== undefined && !tierStillEnabled;
    if (shouldClear) {
      const cleared = setLogTier(query, undefined);
      onChange(setKustoQuery(cleared, ''));
    }
  }, [searchLogsEnabled, basicLogsEnabled, auxiliaryLogsEnabled, onChange, query, showBasicLogsToggle]);

  useEffect(() => {
    const hasRawKql = !!query.azureLogAnalytics?.query;
    const hasNoBuilder = !query.azureLogAnalytics?.builderQuery;
    const modeUnset = query.azureLogAnalytics?.mode === undefined;

    if (hasRawKql && hasNoBuilder && modeUnset) {
      onChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          mode: LogsEditorMode.Raw,
        },
      });
    }
  }, [query, onChange]);

  useEffect(() => {
    if (query.azureLogAnalytics?.mode === LogsEditorMode.Raw && query.azureLogAnalytics?.builderQuery !== undefined) {
      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          builderQuery: undefined,
          query: '',
        },
      });
    }
  }, [query.azureLogAnalytics?.mode, onQueryChange, query]);

  useEffect(() => {
    const getBasicLogsUsage = async (query: AzureMonitorQuery) => {
      try {
        if (showBasicLogsToggle && query.azureLogAnalytics?.basicLogsQuery && !!query.azureLogAnalytics.query) {
          const querySplit = query.azureLogAnalytics.query.split('|');
          // Basic Logs queries are required to start the query with a table
          const table = querySplit[0].trim();
          const dataIngested = await datasource.azureLogAnalyticsDatasource.getBasicLogsQueryUsage(query, table);
          const textToShow = !!dataIngested
            ? t(
                'components.logs-query-editor.warning-data-ingested',
                'This query is processing {{dataIngested}} GiB when run. ',
                { dataIngested }
              )
            : selectedTier === 'Auxiliary'
              ? t(
                  'components.logs-query-editor.warning-auxiliary-raw',
                  "This is an Auxiliary Logs query — uses the search endpoint, incurs cost per GiB scanned, has no response-time SLA, and isn't suitable for real-time or alerting scenarios. Analytics-plan tables can't be queried in this mode (use the Analytics tier for those). "
                )
              : t(
                  'components.logs-query-editor.warning-basic-raw',
                  "This is a Basic Logs query — uses the search endpoint and incurs cost per GiB scanned. Analytics-plan tables can't be queried in this mode (use the Analytics tier for those). "
                );
          setDataIngestedWarning(
            <>
              <Text color="primary">
                {textToShow}{' '}
                <TextLink
                  href="https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-configure?tabs=portal-1"
                  external
                >
                  <Trans i18nKey="components.logs-query-editor.learn-more">Learn More</Trans>
                </TextLink>
              </Text>
            </>
          );
        } else {
          setDataIngestedWarning(null);
        }
      } catch (err) {
        console.error(err);
      }
    };

    getBasicLogsUsage(query).catch((err) => console.error(err));
  }, [datasource.azureLogAnalyticsDatasource, query, showBasicLogsToggle, from, to, selectedTier]);
  let portalLinkButton = null;

  if (data?.series) {
    const querySeries = data.series.find((result) => result.refId === query.refId);
    if (querySeries && querySeries.meta?.custom?.azurePortalLink) {
      portalLinkButton = (
        <>
          <LinkButton
            size="md"
            target="_blank"
            style={{ marginTop: '22px' }}
            href={querySeries.meta?.custom?.azurePortalLink}
          >
            <Trans i18nKey="components.logs-query-editor.view-query">View query in Azure Portal</Trans>
          </LinkButton>
        </>
      );
    }
  }

  return (
    <span data-testid={selectors.components.queryEditor.logsQueryEditor.container.input}>
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <ResourceField
              query={query}
              datasource={datasource}
              inlineField={true}
              labelWidth={10}
              subscriptionId={subscriptionId}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
              selectableEntryTypes={[
                ResourceRowType.Subscription,
                ResourceRowType.ResourceGroup,
                ResourceRowType.Resource,
                ResourceRowType.Variable,
              ]}
              resources={query.azureLogAnalytics?.resources ?? []}
              queryType="logs"
              disableRow={disableRow}
              renderAdvanced={(resources, onChange) => (
                // It's required to cast resources because the resource picker
                // specifies the type to string | AzureMonitorResource.
                // eslint-disable-next-line
                <AdvancedResourcePicker resources={resources as string[]} onChange={onChange} />
              )}
              selectionNotice={(selected) => {
                if (selected.length === 1 && isBasicLogsQuery) {
                  return selectedTier === 'Auxiliary'
                    ? t(
                        'components.logs-query-editor.notice-auxiliary-single-resource',
                        'When using Auxiliary Logs, you may only select one resource at a time.'
                      )
                    : t(
                        'components.logs-query-editor.notice-basic-single-resource',
                        'When using Basic Logs, you may only select one resource at a time.'
                      );
                }
                return t(
                  'components.logs-query-editor.notice-same-resource-type',
                  'You may only choose items of the same resource type.'
                );
              }}
            />
            {showBasicLogsToggle && (
              <LogsManagement
                query={query}
                datasource={datasource}
                variableOptionGroup={variableOptionGroup}
                onQueryChange={onChange}
                setError={setError}
                basicLogsEnabled={basicLogsEnabled}
                auxiliaryLogsEnabled={auxiliaryLogsEnabled}
              />
            )}
            <TimeManagement
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
              schema={schema}
            />
          </EditorFieldGroup>
        </EditorRow>
        <Space />
        {query.azureLogAnalytics?.mode === LogsEditorMode.Builder &&
        !!config.featureToggles.azureMonitorLogsBuilderEditor ? (
          <LogsQueryBuilder
            query={query}
            schema={schema}
            basicLogsEnabled={basicLogsEnabled}
            auxiliaryLogsEnabled={auxiliaryLogsEnabled}
            onQueryChange={onQueryChange}
            templateVariableOptions={templateVariableOptions}
            datasource={datasource}
            timeRange={timeRange}
            isLoadingSchema={isLoadingSchema}
            onTierAutoSwitch={setTierAutoSwitchNotice}
          />
        ) : (
          <QueryField
            query={query}
            datasource={datasource}
            subscriptionId={subscriptionId}
            variableOptionGroup={variableOptionGroup}
            onQueryChange={onChange}
            setError={setError}
            schema={schema}
          />
        )}
        {tierAutoSwitchNotice && (
          <Alert
            severity="info"
            title={t('components.logs-query-editor.tier-switch-title', 'Query tier set to {{toTier}}', {
              toTier: tierAutoSwitchNotice.toTier,
            })}
            onRemove={() => setTierAutoSwitchNotice(null)}
          >
            <Stack direction="column" gap={1}>
              <Text>
                {tierAutoSwitchNotice.toTier === 'Basic' && (
                  <Trans
                    i18nKey="components.logs-query-editor.tier-switch-body-basic"
                    values={{ tableName: tierAutoSwitchNotice.tableName }}
                  >
                    <code>{'{{tableName}}'}</code> is a Basic Logs table — incurs cost per GiB scanned.
                  </Trans>
                )}
                {tierAutoSwitchNotice.toTier === 'Auxiliary' && (
                  <Trans
                    i18nKey="components.logs-query-editor.tier-switch-body-auxiliary"
                    values={{ tableName: tierAutoSwitchNotice.tableName }}
                  >
                    <code>{'{{tableName}}'}</code> is an Auxiliary Logs table — incurs cost per GiB scanned, has no
                    response-time SLA, and isn&apos;t suitable for real-time or alerting scenarios.
                  </Trans>
                )}
                {tierAutoSwitchNotice.toTier === 'Analytics' && (
                  <Trans
                    i18nKey="components.logs-query-editor.tier-switch-body-analytics"
                    values={{ tableName: tierAutoSwitchNotice.tableName }}
                  >
                    <code>{'{{tableName}}'}</code> is an Analytics table.
                  </Trans>
                )}
              </Text>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const { fromTier } = tierAutoSwitchNotice;
                    const tierValue = fromTier === 'Analytics' ? undefined : fromTier;
                    let updated = setLogTier(query, tierValue);
                    // When reverting to Analytics, clear the builder table selection to avoid tier mismatch
                    if (fromTier === 'Analytics' && updated.azureLogAnalytics?.builderQuery) {
                      updated = {
                        ...updated,
                        azureLogAnalytics: {
                          ...updated.azureLogAnalytics,
                          builderQuery: {
                            ...updated.azureLogAnalytics.builderQuery,
                            from: {
                              type: BuilderQueryEditorExpressionType.Property,
                              property: { type: BuilderQueryEditorPropertyType.String, name: '' },
                            },
                          },
                        },
                      };
                    }
                    onChange(updated);
                    setTierAutoSwitchNotice(null);
                  }}
                >
                  {t('components.logs-query-editor.tier-switch-revert', 'Revert to {{fromTier}}', {
                    fromTier: tierAutoSwitchNotice.fromTier,
                  })}
                </Button>
              </div>
            </Stack>
          </Alert>
        )}
        {dataIngestedWarning}
        <EditorRow>
          <EditorFieldGroup>
            {!hideFormatAs && (
              <FormatAsField
                query={query}
                datasource={datasource}
                subscriptionId={subscriptionId}
                variableOptionGroup={variableOptionGroup}
                onQueryChange={onChange}
                setError={setError}
                inputId={'azure-monitor-logs'}
                options={[
                  { label: 'Log', value: ResultFormat.Logs },
                  { label: 'Time series', value: ResultFormat.TimeSeries },
                  { label: 'Table', value: ResultFormat.Table },
                ]}
                defaultValue={ResultFormat.Logs}
                setFormatAs={setFormatAs}
                resultFormat={query.azureLogAnalytics?.resultFormat}
                onLoad={onLoad}
              />
            )}
            {portalLinkButton}
            {migrationError && <Alert title={migrationError.title}>{migrationError.message}</Alert>}
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>
    </span>
  );
};

export default LogsQueryEditor;
