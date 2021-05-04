import React from 'react';
import { AzureMonitorQuery } from '../../types';
import { Alert, Input } from '@grafana/ui';
import { Field } from '../Field';

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
    <Field label="Timegrain">
      <>
        {timeFields.map((timeField) => (
          <Input value={timeField} disabled={true} onChange={() => {}} key={timeField} width={10} />
        ))}
      </>
    </Field>
  );
};

const ApplicationInsightsEditor = ({ query }: { query: AzureMonitorQuery }) => {
  const groupBy = query.appInsights?.dimension || [];

  return (
    <div data-testid="azure-monitor-application-insights-query-editor">
      <Field label="Metric" disabled={true}>
        <Input
          value={query.appInsights?.metricName}
          disabled={true}
          onChange={() => {}}
          id="azure-monitor-application-insights-metric"
        />
      </Field>
      <Field label="Aggregation" disabled={true}>
        <Input value={query.appInsights?.aggregation} disabled={true} onChange={() => {}} />
      </Field>
      {groupBy.length > 0 && (
        <Field label="Group by">
          <>
            {groupBy.map((dimension) => (
              <Input value={dimension} disabled={true} onChange={() => {}} key={dimension} />
            ))}
          </>
        </Field>
      )}
      <Field label="Filter" disabled={true}>
        <Input value={query.appInsights?.dimensionFilter} disabled={true} onChange={() => {}} />
      </Field>
      <ReadOnlyTimeGrain
        timeGrainCount={query.appInsights?.timeGrainCount || ''}
        timeGrainType={query.appInsights?.timeGrainType || 'auto'}
        timeGrainUnit={query.appInsights?.timeGrainUnit || 'minute'}
      />
      <Field label="Legend format" disabled={true}>
        <Input placeholder="Alias patterns" value={query.appInsights?.alias} onChange={() => {}} disabled={true} />
      </Field>
      <Alert severity="info" title="Deprecated">
        Application Insights is deprecated and is now read only. Migrate your queries to Metrics to make changes.
      </Alert>
    </div>
  );
};

export default ApplicationInsightsEditor;
