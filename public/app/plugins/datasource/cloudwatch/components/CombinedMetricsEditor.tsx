import React, { PureComponent } from 'react';
import { ExploreQueryFieldProps } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';
import { CloudWatchQuery } from '../types';
import { CloudWatchDatasource } from '../datasource';
import LogsQueryEditor from './LogsQueryEditor';
import { MetricsQueryEditor } from './MetricsQueryEditor';
import { cx, css } from 'emotion';

export type Props = ExploreQueryFieldProps<CloudWatchDatasource, CloudWatchQuery>;

export class CombinedMetricsEditor extends PureComponent<Props> {
  renderMetricsEditor() {
    return <MetricsQueryEditor {...this.props} />;
  }

  renderLogsEditor() {
    return <LogsQueryEditor {...this.props} />;
  }

  render() {
    const { query } = this.props;

    const apiMode = query.apiMode ?? query.queryMode ?? 'Metrics';

    return (
      <>
        <div
          className={cx(
            css`
              margin-bottom: 4px;
            `
          )}
        >
          <RadioButtonGroup
            options={[
              { label: 'Metrics API', value: 'Metrics' },
              { label: 'Logs API', value: 'Logs' },
            ]}
            value={apiMode}
            onChange={(v: 'Metrics' | 'Logs') => this.props.onChange({ ...query, apiMode: v })}
          />
        </div>
        {apiMode === 'Metrics' ? this.renderMetricsEditor() : this.renderLogsEditor()}
      </>
    );
  }
}
