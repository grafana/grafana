import React, { PureComponent } from 'react';
import { MetadataInspectorProps, DataFrame } from '@grafana/data';
import { GraphiteDatasource } from './datasource';
import { GraphiteQuery, GraphiteOptions, MetricTankMeta, MetricTankResultMeta } from './types';
import { parseSchemaRetentions } from './meta';

export type Props = MetadataInspectorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export interface State {
  index: number;
}

export class MetricTankMetaInspector extends PureComponent<Props, State> {
  state = { index: 0 };

  renderInfo = (info: MetricTankResultMeta, frame: DataFrame) => {
    const buckets = parseSchemaRetentions(info['schema-retentions']);
    return (
      <div>
        <h3>Info</h3>
        <table>
          <tbody>
            {buckets.map(row => (
              <tr key={row.interval}>
                <td>{row.interval} &nbsp;</td>
                <td>{row.retention} &nbsp;</td>
                <td>{row.chunkspan} &nbsp;</td>
                <td>{row.numchunks} &nbsp;</td>
                <td>{row.ready} &nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
        <pre>{JSON.stringify(info, null, 2)}</pre>
      </div>
    );
  };

  render() {
    const { data } = this.props;
    if (!data || !data.length) {
      return <div>No Metadata</div>;
    }

    const frame = data[this.state.index];
    const meta = frame.meta?.custom as MetricTankMeta;
    if (!meta || !meta.info) {
      return <>No Metadatata on DataFrame</>;
    }
    return (
      <div>
        <h3>MetricTank Request</h3>
        <pre>{JSON.stringify(meta.request, null, 2)}</pre>
        {meta.info.map(info => this.renderInfo(info, frame))}
      </div>
    );
  }
}
