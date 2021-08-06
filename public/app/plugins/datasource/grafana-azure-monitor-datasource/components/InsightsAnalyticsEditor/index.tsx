import { Alert, CodeEditor, Select } from '@grafana/ui';
import React from 'react';
import { AzureMonitorOption, AzureMonitorQuery, AzureResultFormat } from '../../types';
import { Field } from '../Field';
import { Space } from '../Space';

interface InsightsAnalyticsEditorProps {
  query: AzureMonitorQuery;
}

const FORMAT_OPTIONS: Array<AzureMonitorOption<AzureResultFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
];

const InsightsAnalyticsEditor: React.FC<InsightsAnalyticsEditorProps> = ({ query }) => {
  return (
    <div data-testid="azure-monitor-insights-analytics-query-editor">
      <CodeEditor
        language="kusto"
        value={query.insightsAnalytics?.query ?? ''}
        height={200}
        width="100%"
        readOnly={true}
        showMiniMap={false}
      />

      <Field label="Format as">
        <Select
          menuShouldPortal
          inputId="azure-monitor-logs-workspaces-field"
          value={query.insightsAnalytics?.resultFormat}
          disabled={true}
          options={FORMAT_OPTIONS}
          onChange={() => {}}
          width={38}
        />
      </Field>

      <Space v={2} />

      <Alert severity="info" title="Deprecated">
        Insights Analytics is deprecated and is now read only. Migrate your queries to Logs to make changes.
      </Alert>
    </div>
  );
};

export default InsightsAnalyticsEditor;
