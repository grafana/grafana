import { useEffect, useState } from 'react';

import { PanelData, TimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { config, getTemplateSrv } from '@grafana/runtime';
import { Alert, LinkButton, Space, Text, TextLink } from '@grafana/ui';

import { LogsEditorMode } from '../../dataquery.gen';
import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { AzureLogAnalyticsMetadataTable } from '../../types/logAnalyticsMetadata';
import { AzureMonitorQuery, ResultFormat } from '../../types/query';
import { AzureMonitorErrorish, AzureMonitorOption, EngineSchema } from '../../types/types';
import { LogsQueryBuilder } from '../LogsQueryBuilder/LogsQueryBuilder';
import ResourceField from '../ResourceField';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';
import FormatAsField from '../shared/FormatAsField';

import AdvancedResourcePicker from './AdvancedResourcePicker';
import { LogsManagement } from './LogsManagement';
import QueryField from './QueryField';
import { TimeManagement } from './TimeManagement';
import { onLoad, setBasicLogsQuery, setFormatAs, setKustoQuery } from './setQueryValue';
import useMigrations from './useMigrations';
import { shouldShowBasicLogsToggle } from './utils';

interface LogsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  basicLogsEnabled: boolean;
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
  const [showBasicLogsToggle, setShowBasicLogsToggle] = useState<boolean>(
    shouldShowBasicLogsToggle(query.azureLogAnalytics?.resources || [], basicLogsEnabled)
  );
  const [dataIngestedWarning, setDataIngestedWarning] = useState<React.ReactNode | null>(null);
  const templateSrv = getTemplateSrv();
  const from = templateSrv?.replace('$__from');
  const to = templateSrv?.replace('$__to');
  const templateVariableOptions = templateSrv.getVariables();
  const isBasicLogsQuery = (basicLogsEnabled && query.azureLogAnalytics?.basicLogsQuery) ?? false;
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
    if (shouldShowBasicLogsToggle(query.azureLogAnalytics?.resources || [], basicLogsEnabled)) {
      setShowBasicLogsToggle(true);
    } else {
      setShowBasicLogsToggle(false);
    }
  }, [basicLogsEnabled, query.azureLogAnalytics?.resources, templateSrv]);

  useEffect(() => {
    if ((!basicLogsEnabled || !showBasicLogsToggle) && query.azureLogAnalytics?.basicLogsQuery) {
      const updatedBasicLogsQuery = setBasicLogsQuery(query, false);
      onChange(setKustoQuery(updatedBasicLogsQuery, ''));
    }
  }, [basicLogsEnabled, onChange, query, showBasicLogsToggle]);

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
            ? `This query is processing ${dataIngested} GiB when run. `
            : 'This is a Basic Logs query and incurs cost per GiB scanned. ';
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
  }, [datasource.azureLogAnalyticsDatasource, query, showBasicLogsToggle, from, to]);
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
                  return 'When using Basic Logs, you may only select one resource at a time.';
                }
                return 'You may only choose items of the same resource type.';
              }}
            />
            {showBasicLogsToggle && (
              <LogsManagement
                query={query}
                datasource={datasource}
                variableOptionGroup={variableOptionGroup}
                onQueryChange={onChange}
                setError={setError}
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
            onQueryChange={onQueryChange}
            templateVariableOptions={templateVariableOptions}
            datasource={datasource}
            timeRange={timeRange}
            isLoadingSchema={isLoadingSchema}
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
