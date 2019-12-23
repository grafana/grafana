import React, { PureComponent } from 'react';
import { MetadataInspectorProps } from '@grafana/data';
import { GraphiteDatasource } from './datasource';
import { GraphiteQuery, GraphiteOptions, MetricTankMeta } from './types';

export type Props = MetadataInspectorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export interface State {
  index: number;
}

export class MetricTankMetaInspector extends PureComponent<Props, State> {
  state = { index: 0 };

  render() {
    const { data } = this.props;
    if (!data || !data.length) {
      return <div>No Metadata</div>;
    }

    const frame = data[this.state.index];
    const meta = frame.meta?.ds as MetricTankMeta;
    if (!meta || !meta.info) {
      return <>No Metadatata on DataFrame</>;
    }
    return (
      <div>
        <h3>MetricTank Meta</h3>
        <pre>{JSON.stringify(meta.info, null, 2)}</pre>
      </div>
    );
  }
}
