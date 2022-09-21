import React, { useState } from 'react';

import { EditorFieldGroup, EditorRow, EditorRows, Input } from '@grafana/ui';

import Datasource from '../../datasource';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import { Field } from '../Field';
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
  const [operationId, setOperationId] = useState('');
  return (
    <span data-testid="azure-monitor-logs-query-editor-with-experimental-ui">
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <ResourceField
              query={query}
              datasource={datasource}
              inlineField={true}
              labelWidth={15}
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
        <EditorRow>
          <Field label="Operation ID" inlineField labelWidth={15}>
            <Input
              placeholder="Operation ID"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const opIdQuery = event.target?.value;
                console.log(opIdQuery);
                setOperationId(opIdQuery);
                query.operationId = event.target?.value;
                onChange(query);
              }}
              value={operationId}
            />
          </Field>
        </EditorRow>
      </EditorRows>
    </span>
  );
};

export default TraceEditor;
