import React, { PureComponent } from 'react';
import { ExploreQueryFieldProps, ExploreMode } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { CloudWatchQuery, CloudWatchMetricsQuery, CloudWatchLogsQuery } from '../types';
import { CloudWatchDatasource } from '../datasource';
import { QueryInlineField } from './';
import { MetricsQueryEditor } from './MetricsQueryEditor';
import LogsQueryEditor from './LogsQueryEditor';

export type Props = ExploreQueryFieldProps<CloudWatchDatasource, CloudWatchQuery>;

const apiModes = {
  Metrics: { label: 'CloudWatch Metrics', value: 'Metrics' },
  Logs: { label: 'CloudWatch Logs', value: 'Logs' },
};

export class PanelQueryEditor extends PureComponent<Props> {
  render() {
    const { query } = this.props;
    const apiMode = query.apiMode ?? query.queryMode ?? 'Metrics';

    return (
      <>
        <QueryInlineField label="Query Mode">
          <Segment
            value={apiModes[apiMode]}
            options={Object.values(apiModes)}
            onChange={({ value }) => {
              const newMode = (value as 'Metrics' | 'Logs') ?? 'Metrics';
              if (newMode === 'Metrics') {
                this.props.onChange({
                  ...(query as CloudWatchMetricsQuery),
                  apiMode: newMode,
                  queryMode: newMode,
                });
              } else {
                this.props.onChange({
                  ...(query as CloudWatchLogsQuery),
                  apiMode: newMode,
                  queryMode: newMode,
                });
              }
            }}
          />
        </QueryInlineField>
        {apiMode === ExploreMode.Logs ? (
          <LogsQueryEditor {...this.props} allowCustomValue />
        ) : (
          <MetricsQueryEditor {...this.props} />
        )}
      </>
    );
  }
}
