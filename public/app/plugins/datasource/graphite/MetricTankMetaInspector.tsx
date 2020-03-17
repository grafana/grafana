import React, { PureComponent } from 'react';
import { MetadataInspectorProps } from '@grafana/data';
import { GraphiteDatasource } from './datasource';
import { GraphiteQuery, GraphiteOptions, MetricTankSeriesMeta } from './types';
import { parseSchemaRetentions } from './meta';

export type Props = MetadataInspectorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export interface State {
  index: number;
}

export class MetricTankMetaInspector extends PureComponent<Props, State> {
  renderMeta(meta: MetricTankSeriesMeta) {
    const buckets = parseSchemaRetentions(meta['schema-retentions']);

    return (
      <div>
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
      </div>
    );
  }

  render() {
    const { data } = this.props;

    // away to dedupe them
    const seriesMetas: Record<string, MetricTankSeriesMeta> = {};

    for (const series of data) {
      if (series.meta && series.meta.custom) {
        for (const metaItem of series.meta.custom.seriesMetaList as MetricTankSeriesMeta[]) {
          // key is to dedupe as many series will have identitical meta
          const key = `${metaItem['schema-name']}-${metaItem['archive-read']}`;
          seriesMetas[key] = metaItem;
        }
      }
    }

    if (Object.keys(seriesMetas).length === 0) {
      return <div>No response meta data</div>;
    }

    return <div>{Object.values(seriesMetas).map(meta => this.renderMeta(meta))}</div>;
  }
}
