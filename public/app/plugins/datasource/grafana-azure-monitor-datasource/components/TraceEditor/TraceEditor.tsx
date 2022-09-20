import React from 'react';

import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/ui';

import QueryBuilder from '../../azure_log_analytics/app_insights_traces/queryBuilder';
import Datasource from '../../datasource';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import ResourceField from '../ResourceField';
import { ResourceRowType } from '../ResourcePicker/types';

interface TraceEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const TraceEditor: React.FC<TraceEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  const queryBuilder = new QueryBuilder('646c9c58c2594d53b4d3ce0075747863', query);
  console.log(queryBuilder.buildTraceQuery());

  return (
    <span data-testid="azure-monitor-logs-query-editor-with-experimental-ui">
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <ResourceField
              query={queryBuilder.buildTraceQuery()}
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
              resource={query.azureLogAnalytics?.resource ?? ''}
              queryType="logs"
            />
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>
    </span>
  );
};

export default TraceEditor;
