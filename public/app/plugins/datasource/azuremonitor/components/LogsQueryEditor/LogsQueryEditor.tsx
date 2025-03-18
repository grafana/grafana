import { useEffect, useState } from 'react';

import { PanelData, TimeRange } from '@grafana/data';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';
import { getTemplateSrv } from '@grafana/runtime';
import { Alert, LinkButton, Text, TextLink } from '@grafana/ui';

import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery, ResultFormat, EngineSchema } from '../../types';
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

  const disableRow = (row: ResourceRow, selectedRows: ResourceRowGroup) => {
    if (selectedRows.length === 0) {
      // Only if there is some resource(s) selected we should disable rows
      return false;
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
    if (query.azureLogAnalytics?.resources && query.azureLogAnalytics.resources.length) {
      datasource.azureLogAnalyticsDatasource.getKustoSchema(query.azureLogAnalytics.resources[0]).then((schema) => {
        setSchema(schema);
      });
    }
  }, [query.azureLogAnalytics?.resources, datasource.azureLogAnalyticsDatasource]);

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
                  Learn More
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
            View query in Azure Portal
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
              selectionNotice={() => 'You may only choose items of the same resource type.'}
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
        <QueryField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
          schema={schema}
        />
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
