import React, { PureComponent } from 'react';
import { QueryEditorProps, ExploreMode } from '@grafana/data';
import { CloudWatchJsonData, CloudWatchQuery } from '../types';
import { CloudWatchDatasource } from '../datasource';
import { MetricsQueryEditor } from './MetricsQueryEditor';
import LogsQueryEditor from './LogsQueryEditor';

export type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>;

export class PanelQueryEditor extends PureComponent<Props> {
  render() {
    const { query } = this.props;
    const apiMode = query.queryMode ?? 'Metrics';

    return (
      <>
        {apiMode === ExploreMode.Logs ? (
          <LogsQueryEditor {...this.props} allowCustomValue />
        ) : (
          <MetricsQueryEditor {...this.props} />
        )}
      </>
    );
  }
}
