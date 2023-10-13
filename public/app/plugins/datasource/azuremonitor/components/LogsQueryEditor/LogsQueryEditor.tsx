import { gzip } from 'node-gzip';
import React, { useEffect, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';
import { Alert, Button } from '@grafana/ui';


import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery, ResultFormat, EngineSchema } from '../../types';
import FormatAsField from '../FormatAsField';
import ResourceField from '../ResourceField';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';

import AdvancedResourcePicker from './AdvancedResourcePicker';
import QueryField from './QueryField';
import { TimeManagement } from './TimeManagement';
import { setFormatAs } from './setQueryValue';
import useMigrations from './useMigrations';

interface LogsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
  hideFormatAs?: boolean;
  timeRange?: TimeRange;
}

const LogsQueryEditor = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
  hideFormatAs,
  timeRange,
}: LogsQueryEditorProps) => {
  const migrationError = useMigrations(datasource, query, onChange);
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

  async function getQueryUrl(
  ): Promise<string> {
    let queryString = query.azureLogAnalytics?.query || "";
    const r = await gzip(queryString);
    const resources = query.azureLogAnalytics?.resources || [];

    let portalUrl = datasource.azureLogAnalyticsDatasource.azurePortalUrl + '/#blade/Microsoft_OperationsManagementSuite_Workspace/AnalyticsBlade/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope/';
  
    const resourcesJson: {Resources: Array<{ResourceID: string}>} = {
      Resources: [],
    };
    for (const resource of resources) {
      resourcesJson.Resources.push({
        ResourceID: resource,
      });
    }
  
    let resourcesMarshalled = JSON.stringify(resourcesJson);
  
    const from = timeRange?.from.toISOString();
    const to = timeRange?.to.toISOString();
    const timespan = encodeURIComponent(`${from}/${to}`);
  
    portalUrl += encodeURIComponent(resourcesMarshalled);
    portalUrl += '/query/' + encodeURIComponent(r.toString() || '') + '/isQueryBase64Compressed/true/timespan/' + timespan;
  
    return portalUrl;
  }

  const queryAzureMonitor = async () => {
    window.location.replace(await getQueryUrl());
  };

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
              />
            )}

            {migrationError && <Alert title={migrationError.title}>{migrationError.message}</Alert>}
          </EditorFieldGroup>
          <Button
            icon='link'
            type="button"
            onClick={queryAzureMonitor}
          >
            View in Azure Portal
          </Button>
        </EditorRow>
      </EditorRows>
    </span>
  );
};

export default LogsQueryEditor;
//https://portal.azure.com/#view/Microsoft_OperationsManagementSuite_Workspace/Logs.ReactView/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope~/%7B%22Resources%22%3A%5B%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fcloud-plugins-e2e-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Faz-mon-test-logs%22%7D%2C%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fandreas-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2F34e51f5d-028b-49b9-af99-05dd61f02198-andreas-test-SUK%22%7D%2C%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fcloud-plugins-e2e-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fazmonlogstest%22%7D%2C%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F44693801-6ee6-49de-9b2d-9106972f9572%2FresourceGroups%2Fcloud-datasources%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fazmonlogstest%22%7D%2C%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F44693801-6ee6-49de-9b2d-9106972f9572%2FresourceGroups%2Fcloud-datasources%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2FAzureActivityLog%22%7D%5D%7D/query/AzureActivity%0A%7C%20limit%2010                                        /isQueryBase64Compressed/true/timespan/2023-09-13T20%3A33%3A04.313Z%2F2023-10-13T20%3A33%3A04.313Z
//https://portal.azure.com/#view/Microsoft_OperationsManagementSuite_Workspace/Logs.ReactView/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope~/%7B%22resources%22%3A%5B%7B%22resourceId%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fcloud-plugins-e2e-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Faz-mon-test-logs%22%7D%2C%7B%22resourceId%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fandreas-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2F34e51f5d-028b-49b9-af99-05dd61f02198-andreas-test-SUK%22%7D%2C%7B%22resourceId%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fcloud-plugins-e2e-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fazmonlogstest%22%7D%2C%7B%22resourceId%22%3A%22%2Fsubscriptions%2F44693801-6ee6-49de-9b2d-9106972f9572%2FresourceGroups%2Fcloud-datasources%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fazmonlogstest%22%7D%2C%7B%22resourceId%22%3A%22%2Fsubscriptions%2F44693801-6ee6-49de-9b2d-9106972f9572%2FresourceGroups%2Fcloud-datasources%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2FAzureActivityLog%22%7D%5D%7D/query/H4sIAAAAAAAA%2F3KsKi1KdUwuySzLLKnkqlHIyczNLFEwNAAEAAD%2F%2Fz%2BNXS8YAAAA/isQueryBase64Compressed/true/timespan/2023-09-13T20%3A32%3A57Z%2F2023-10-13T20%3A32%3A57Z
//https://portal.azure.com/#view/Microsoft_OperationsManagementSuite_Workspace/Logs.ReactView/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope~/%7B%22Resources%22%3A%5B%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fandreas-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fandreas-log-analytics%22%7D%2C%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fcloud-plugins-e2e-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Faz-mon-test-logs%22%7D%2C%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fandreas-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2F34e51f5d-028b-49b9-af99-05dd61f02198-andreas-test-SUK%22%7D%5D%7D/query/QXp1cmVBY3Rpdml0eQp8IGxpbWl0IDEw/isQueryBase64Compressed/true/timespan/2023-09-13T20%3A47%3A08.974Z%2F2023-10-13T20%3A47%3A08.974Z
//https://portal.azure.com/#view/Microsoft_OperationsManagementSuite_Workspace/Logs.ReactView/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope~/%7B%22resources%22%3A%5B%7B%22resourceId%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fcloud-plugins-e2e-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fazmonlogstest%22%7D%2C%7B%22resourceId%22%3A%22%2Fsubscriptions%2F44693801-6ee6-49de-9b2d-9106972f9572%2FresourceGroups%2Fcloud-datasources%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fazmonlogstest%22%7D%5D%7D/query/H4sIAAAAAAAA%2F3KsKi1KdUwuySzLLKnkqlHIyczNLFEwNAAEAAD%2F%2Fz%2BNXS8YAAAA/isQueryBase64Compressed/true/timespan/2023-09-13T20%3A48%3A24Z%2F2023-10-13T20%3A48%3A24Z
//https://portal.azure.com/#view/Microsoft_OperationsManagementSuite_Workspace/Logs.ReactView/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope~/%7B%22Resources%22%3A%5B%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F34e51f5d-028b-49b9-af99-05dd61f02198%2FresourceGroups%2Fcloud-plugins-e2e-test%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fazmonlogstest%22%7D%2C%7B%22ResourceID%22%3A%22%2Fsubscriptions%2F44693801-6ee6-49de-9b2d-9106972f9572%2FresourceGroups%2Fcloud-datasources%2Fproviders%2FMicrosoft.OperationalInsights%2Fworkspaces%2Fazmonlogstest%22%7D%5D%7D/query/QXp1cmVBY3Rpdml0eQp8IGxpbWl0IDEw/isQueryBase64Compressed/true/timespan/2023-09-13T20%3A48%3A27.887Z%2F2023-10-13T20%3A48%3A27.887Z
