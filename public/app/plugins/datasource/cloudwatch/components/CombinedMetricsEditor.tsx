import React, { PureComponent } from 'react';
import { ExploreQueryFieldProps } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';
import { CloudWatchQuery } from '../types';
import { CloudWatchDatasource } from '../datasource';
import LogsQueryEditor from './LogsQueryEditor';
import { MetricsQueryEditor } from './MetricsQueryEditor';
import { cx, css } from 'emotion';

export type Props = ExploreQueryFieldProps<CloudWatchDatasource, CloudWatchQuery>;

interface State {
  apiMode: 'logs' | 'metrics';
}

export class CombinedMetricsEditor extends PureComponent<Props, State> {
  state: State = { apiMode: 'metrics' };

  onAPIModeChange(newMode: 'metrics' | 'logs') {
    this.setState({
      apiMode: newMode,
    });
  }

  renderMetricsEditor() {
    return <MetricsQueryEditor {...this.props} />;
  }

  renderLogsEditor() {
    return <LogsQueryEditor {...this.props} />;
  }

  render() {
    const { apiMode } = this.state;

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
              { label: 'Metrics API', value: 'metrics' },
              { label: 'Logs API', value: 'logs' },
            ]}
            value={apiMode}
            onChange={(v: 'metrics' | 'logs') => this.onAPIModeChange(v!)}
          />
        </div>
        {apiMode === 'metrics' ? this.renderMetricsEditor() : this.renderLogsEditor()}
      </>
    );
  }
}
