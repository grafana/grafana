import type { CoreApp, PanelData, TimeRange } from '@grafana/data';
import { PromQueryBuilderContainer, PromQueryBuilderOptions, type PromQuery } from '@grafana/prometheus';
import { Stack } from '@grafana/ui';

import { type CloudWatchMetricsQuery } from '../../../dataquery.gen';
import { type CloudWatchDatasource } from '../../../datasource';

import { useCloudWatchPrometheusDatasource } from './cloudWatchPrometheusDatasourceShim';

export interface PromQLBuilderEditorProps {
  query: CloudWatchMetricsQuery;
  onChange: (query: CloudWatchMetricsQuery) => void;
  onRunQuery: () => void;
  datasource: CloudWatchDatasource;
  timeRange: TimeRange;
  app?: CoreApp;
  showExplain: boolean;
  data?: PanelData;
}

export const PromQLBuilderEditor = ({
  query,
  onChange,
  onRunQuery,
  datasource,
  timeRange,
  app,
  showExplain,
  data,
}: PromQLBuilderEditorProps) => {
  const prometheusDatasourceShim = useCloudWatchPrometheusDatasource(datasource, query.region, timeRange);

  const promQuery: PromQuery = {
    refId: query.refId,
    expr: query.promqlExpression ?? '',
    format: query.format,
    instant: query.instant,
    range: query.range,
    interval: query.interval,
    legendFormat: query.legendFormat ?? '__auto',
  };

  const handleChange = (next: PromQuery) => {
    onChange({
      ...query,
      promqlExpression: next.expr,
      format: next.format,
      instant: next.instant,
      range: next.range,
      interval: next.interval,
      legendFormat: next.legendFormat,
    });
  };

  return (
    <Stack direction="column" gap={0.5}>
      <PromQueryBuilderContainer
        query={promQuery}
        datasource={prometheusDatasourceShim}
        onChange={handleChange}
        onRunQuery={onRunQuery}
        showExplain={showExplain}
        data={data}
      />
      <PromQueryBuilderOptions
        query={promQuery}
        app={app}
        onChange={handleChange}
        onRunQuery={onRunQuery}
        uiOptions={{ exemplars: false, disableTypeBoth: true }}
        formatOptions={[
          { label: 'Time series', value: 'time_series' },
          { label: 'Table', value: 'table' },
        ]}
      />
    </Stack>
  );
};
