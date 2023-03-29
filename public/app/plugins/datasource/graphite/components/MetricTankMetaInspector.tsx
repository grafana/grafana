import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { MetadataInspectorProps, rangeUtil } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

import { GraphiteDatasource } from '../datasource';
import { getRollupNotice, getRuntimeConsolidationNotice, parseSchemaRetentions } from '../meta';
import { GraphiteOptions, GraphiteQuery, MetricTankSeriesMeta } from '../types';

export type Props = MetadataInspectorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export interface State {
  index: number;
}

export class MetricTankMetaInspector extends PureComponent<Props, State> {
  renderMeta(meta: MetricTankSeriesMeta, key: string) {
    const styles = getStyles();
    const buckets = parseSchemaRetentions(meta['schema-retentions']);
    const rollupNotice = getRollupNotice([meta]);
    const runtimeNotice = getRuntimeConsolidationNotice([meta]);
    const normFunc = (meta['consolidator-normfetch'] ?? '').replace('Consolidator', '');

    const totalSeconds = buckets.reduce(
      (acc, bucket) => acc + (bucket.retention ? rangeUtil.intervalToSeconds(bucket.retention) : 0),
      0
    );

    return (
      <div className={styles.metaItem} key={key}>
        <div className={styles.metaItemHeader}>
          Schema: {meta['schema-name']}
          <div className="small muted">Series count: {meta.count}</div>
        </div>
        <div className={styles.metaItemBody}>
          <div className={styles.step}>
            <div className={styles.stepHeading}>Step 1: Fetch</div>
            <div className={styles.stepDescription}>
              First data is fetched, either from raw data archive or a rollup archive
            </div>

            {rollupNotice && <p>{rollupNotice.text}</p>}
            {!rollupNotice && <p>No rollup archive was used</p>}

            <div>
              {buckets.map((bucket, index) => {
                const bucketLength = bucket.retention ? rangeUtil.intervalToSeconds(bucket.retention) : 0;
                const lengthPercent = (bucketLength / totalSeconds) * 100;
                const isActive = index === meta['archive-read'];

                return (
                  <div key={bucket.retention} className={styles.bucket}>
                    <div className={styles.bucketInterval}>{bucket.interval}</div>
                    <div
                      className={cx(styles.bucketRetention, { [styles.bucketRetentionActive]: isActive })}
                      style={{ flexGrow: lengthPercent }}
                    />
                    <div style={{ flexGrow: 100 - lengthPercent }}>{bucket.retention}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepHeading}>Step 2: Normalization</div>
            <div className={styles.stepDescription}>
              Normalization happens when series with different intervals between points are combined.
            </div>

            {meta['aggnum-norm'] > 1 && <p>Normalization did occur using {normFunc}</p>}
            {meta['aggnum-norm'] === 1 && <p>No normalization was needed</p>}
          </div>

          <div className={styles.step}>
            <div className={styles.stepHeading}>Step 3: Runtime consolidation</div>
            <div className={styles.stepDescription}>
              If there are too many data points at this point Metrictank will consolidate them down to below max data
              points (set in queries tab).
            </div>

            {runtimeNotice && <p>{runtimeNotice.text}</p>}
            {!runtimeNotice && <p>No runtime consolidation</p>}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { data } = this.props;

    // away to dedupe them
    const seriesMetas: Record<string, MetricTankSeriesMeta> = {};

    for (const series of data) {
      if (series?.meta?.custom?.seriesMetaList) {
        for (const metaItem of series.meta.custom.seriesMetaList as MetricTankSeriesMeta[]) {
          // key is to dedupe as many series will have identitical meta
          const key = `${JSON.stringify(metaItem)}`;

          if (seriesMetas[key]) {
            seriesMetas[key].count += metaItem.count;
          } else {
            seriesMetas[key] = metaItem;
          }
        }
      }
    }

    if (Object.keys(seriesMetas).length === 0) {
      return <div>No response meta data</div>;
    }

    return (
      <div>
        <h2 className="page-heading">Metrictank Lineage</h2>
        {Object.keys(seriesMetas).map((key) => this.renderMeta(seriesMetas[key], key))}
      </div>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;
  const borderColor = theme.isDark ? theme.palette.gray25 : theme.palette.gray85;
  const background = theme.isDark ? theme.palette.dark1 : theme.palette.white;
  const headerBg = theme.isDark ? theme.palette.gray15 : theme.palette.gray85;

  return {
    metaItem: css`
      background: ${background};
      border: 1px solid ${borderColor};
      margin-bottom: ${theme.spacing.md};
    `,
    metaItemHeader: css`
      background: ${headerBg};
      padding: ${theme.spacing.xs} ${theme.spacing.md};
      font-size: ${theme.typography.size.md};
      display: flex;
      justify-content: space-between;
    `,
    metaItemBody: css`
      padding: ${theme.spacing.md};
    `,
    stepHeading: css`
      font-size: ${theme.typography.size.md};
    `,
    stepDescription: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
      margin-bottom: ${theme.spacing.sm};
    `,
    step: css`
      margin-bottom: ${theme.spacing.lg};

      &:last-child {
        margin-bottom: 0;
      }
    `,
    bucket: css`
      display: flex;
      margin-bottom: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
    `,
    bucketInterval: css`
      flex-grow: 0;
      width: 60px;
    `,
    bucketRetention: css`
      background: linear-gradient(0deg, ${theme.palette.blue85}, ${theme.palette.blue95});
      text-align: center;
      color: ${theme.palette.white};
      margin-right: ${theme.spacing.md};
      border-radius: ${theme.border.radius.sm};
    `,
    bucketRetentionActive: css`
      background: linear-gradient(0deg, ${theme.palette.greenBase}, ${theme.palette.greenShade});
    `,
  };
});
