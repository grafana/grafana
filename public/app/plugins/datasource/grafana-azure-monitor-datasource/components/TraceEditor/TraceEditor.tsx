import React from 'react';

import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/ui';

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
  return (
    <span data-testid="azure-monitor-logs-query-editor-with-experimental-ui">
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
