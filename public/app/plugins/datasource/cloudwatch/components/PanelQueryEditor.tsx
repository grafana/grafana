import React, { PureComponent } from 'react';
import { ExploreQueryFieldProps, ExploreMode } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { CloudWatchQuery } from '../types';
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
            onChange={({ value }) =>
              this.props.onChange({ ...query, apiMode: (value as 'Metrics' | 'Logs') ?? 'Metrics' })
            }
          />
        </QueryInlineField>
        {apiMode === ExploreMode.Logs ? <LogsQueryEditor {...this.props} /> : <MetricsQueryEditor {...this.props} />}
      </>
    );
  }
}
