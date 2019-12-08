import React, { PureComponent } from 'react';
import { MetadataInspectorProps } from '@grafana/data';
import { GraphiteDatasource } from './datasource';
import { GraphiteQuery, GraphiteOptions, MetricTankMeta } from './types';

export type Props = MetadataInspectorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export class MetricTankMetaInspector extends PureComponent<Props> {
  render() {
    const { data } = this.props;
    if (!data) {
      return <div>TODO: Show Global Response Metadata</div>;
    }
    const meta = data.meta?.ds as MetricTankMeta;
    if (!meta || !meta.info) {
      return <></>;
    }
    return (
      <div>
        <h3>MetricTank Meta</h3>
        <pre>{JSON.stringify(meta.info, null, 2)}</pre>
      </div>
    );
  }
}
