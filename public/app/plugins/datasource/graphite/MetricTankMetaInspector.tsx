import React, { PureComponent } from 'react';
import { MetadataInspectorProps } from '@grafana/data';
import { GraphiteDatasource } from './datasource';
import { GraphiteQuery, GraphiteOptions } from './types';

export type Props = MetadataInspectorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

interface State {}

export class MetricTankMetaInspector extends PureComponent<Props, State> {
  state: State = {};

  render() {
    return (
      <>
        <div>TODO: show metric tank metadata</div>
      </>
    );
  }
}
