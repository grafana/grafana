import React from 'react';
import { AzureMonitorQuery } from '../../types';
import { Card, Field, InlineField, InlineFieldRow, Input } from '@grafana/ui';

const ReadOnlyTimeGrain = ({
  timeGrainCount,
  timeGrainType,
  timeGrainUnit,
}: {
  timeGrainCount: string;
  timeGrainType: string;
  timeGrainUnit: string;
}) => {
  const timeFields = timeGrainType === 'specific' ? ['specific', timeGrainCount, timeGrainUnit] : [timeGrainType];

  return (
    <InlineField label="Timegrain">
      <>
        {timeFields.map((timeField) => (
          <Input value={timeField} disabled={true} onChange={() => {}} key={timeField} width={10} />
        ))}
      </>
    </InlineField>
  );
};

const ApplicationInsightsEditor = ({ query }: { query: AzureMonitorQuery }) => {
  const groupBy = query.appInsights?.dimension || [];

  return (
    <div data-testid="azure-monitor-application-insights-query-editor">
      <InlineFieldRow>
        <InlineField label="Metric" disabled={true}>
          <Input
            value={query.appInsights?.metricName}
            disabled={true}
            onChange={() => {}}
            id="azure-monitor-application-insights-metric"
          />
        </InlineField>
        <InlineField label="Aggregation" disabled={true}>
          <Input value={query.appInsights?.aggregation} disabled={true} onChange={() => {}} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Group by">
          <>
            {groupBy.map((dimension) => (
              <Input value={dimension} disabled={true} onChange={() => {}} key={dimension} />
            ))}
          </>
        </InlineField>
        <InlineField label="Filter" disabled={true}>
          <Input value={query.appInsights?.dimensionFilter} disabled={true} onChange={() => {}} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <ReadOnlyTimeGrain
          timeGrainCount={query.appInsights?.timeGrainCount || ''}
          timeGrainType={query.appInsights?.timeGrainType || 'auto'}
          timeGrainUnit={query.appInsights?.timeGrainUnit || 'minute'}
        />
      </InlineFieldRow>
      <InlineFieldRow>
        <Field label="Legend format" disabled={true}>
          <Input placeholder="Alias patterns" value={query.appInsights?.alias} onChange={() => {}} disabled={true} />
        </Field>
      </InlineFieldRow>
      <Card
        href="https://grafana.com/docs/grafana/latest/datasources/azuremonitor/#deprecating-application-insights-and-insights-analytics"
        heading="Deprecated"
        description="Application Insights and Insights Analytics are now deprecated and read only."
      />
    </div>
  );
};

export default ApplicationInsightsEditor;
