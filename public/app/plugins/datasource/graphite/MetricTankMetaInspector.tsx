import { css } from 'emotion';
import React, { PureComponent } from 'react';
import { MetadataInspectorProps } from '@grafana/data';
import { GraphiteDatasource } from './datasource';
import { GraphiteQuery, GraphiteOptions, MetricTankSeriesMeta } from './types';
import { parseSchemaRetentions, getRollupNotice } from './meta';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import kbn from 'app/core/utils/kbn';

export type Props = MetadataInspectorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export interface State {
  index: number;
}

export class MetricTankMetaInspector extends PureComponent<Props, State> {
  renderMeta(meta: MetricTankSeriesMeta) {
    const styles = getStyles();
    const buckets = parseSchemaRetentions(meta['schema-retentions']);
    const notice = getRollupNotice([meta]);

    let totalSeconds = 0;
    let currentPos = 0;

    for (const bucket of buckets) {
      totalSeconds += kbn.interval_to_seconds(bucket.retention);
    }

    return (
      <div className={styles.metaItem}>
        <h3 className="section-heading">Schema: {meta['schema-name']}</h3>
        <p>Description: {notice.text}</p>

        {buckets.map(bucket => {
          const bucketLength = kbn.interval_to_seconds(bucket.retention);
          const lengthPercent = (bucketLength / totalSeconds) * 100;

          return (
            <div key={bucket.retention} className={styles.bucket}>
              <div className={styles.bucketInterval}>{bucket.interval}</div>
              <div className={styles.bucketRetention} style={{ flexGrow: lengthPercent }} />
              <div style={{ flexGrow: 100 - lengthPercent }}>{bucket.retention}</div>
            </div>
          );
        })}
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

    return (
      <div>
        <h2 className="page-heading">Aggregation & rollup</h2>
        {Object.values(seriesMetas).map(meta => this.renderMeta(meta))}
      </div>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;
  const borderColor = theme.isDark ? theme.colors.gray25 : theme.colors.gray85;
  const background = theme.isDark ? theme.colors.dark1 : theme.colors.white;

  return {
    metaItem: css`
      background: ${background};
      padding: ${theme.spacing.md};
      border: 1px solid ${borderColor};
      margin-bottom: ${theme.spacing.md};
    `,
    bucket: css`
      display: flex;
      margin-bottom: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.md};
    `,
    bucketInterval: css`
      flex-grow: 0;
      width: 60px;
    `,
    bucketRetention: css`
      background: linear-gradient(0deg, ${theme.colors.blue85}, ${theme.colors.blue95});
      text-align: center;
      color: ${theme.colors.white};
      margin-right: ${theme.spacing.md};
    `,
    bucketRetentionActive: css`
      background: linear-gradient(0deg, ${theme.colors.greenBase}, ${theme.colors.greenShade});
    `,
  };
});
