import React, { PureComponent } from 'react';

import { QueryEditorProps } from '@grafana/data';

import { CloudWatchDatasource } from '../datasource';
import { isCloudWatchMetricsQuery } from '../guards';
import { CloudWatchJsonData, CloudWatchQuery } from '../types';

import { MetricsQueryEditor } from '././MetricsQueryEditor/MetricsQueryEditor';
import LogsQueryEditor from './LogsQueryEditor';

export type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>;

export class PanelQueryEditor extends PureComponent<Props> {
  render() {
    const { query } = this.props;

    return (
      <>
        {isCloudWatchMetricsQuery(query) ? (
          <MetricsQueryEditor {...this.props} query={query} />
        ) : (
          <LogsQueryEditor {...this.props} allowCustomValue />
        )}
      </>
    );
  }
}
