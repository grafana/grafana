import { css, cx } from '@emotion/css';
import { memo } from 'react';

import { type GrafanaTheme2, type MetadataInspectorProps, rangeUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type GraphiteDatasource } from '../datasource';
import { getRollupNotice, getRuntimeConsolidationNotice, parseSchemaRetentions } from '../meta';
import { type GraphiteOptions, type GraphiteQuery, type MetricTankSeriesMeta } from '../types';

export type Props = MetadataInspectorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export const MetricTankMetaInspector = memo(function MetricTankMetaInspector({ data }: Props) {
  const styles = useStyles2(getStyles);

  function renderMeta(meta: MetricTankSeriesMeta, key: string) {
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

  // away to dedupe them
  const seriesMetas: Record<string, MetricTankSeriesMeta> = {};

  for (const series of data) {
    const seriesMetaList: MetricTankSeriesMeta[] | undefined = series?.meta?.custom?.seriesMetaList;
    if (seriesMetaList) {
      for (const metaItem of seriesMetaList) {
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
      {Object.keys(seriesMetas).map((key) => renderMeta(seriesMetas[key], key))}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  const { v1 } = theme;
  const borderColor = v1.isDark ? v1.palette.gray25 : v1.palette.gray85;
  const background = v1.isDark ? v1.palette.dark1 : v1.palette.white;
  const headerBg = v1.isDark ? v1.palette.gray15 : v1.palette.gray85;

  return {
    metaItem: css({
      background: background,
      border: `1px solid ${borderColor}`,
      marginBottom: v1.spacing.md,
    }),
    metaItemHeader: css({
      background: headerBg,
      padding: `${v1.spacing.xs} ${v1.spacing.md}`,
      fontSize: v1.typography.size.md,
      display: 'flex',
      justifyContent: 'space-between',
    }),
    metaItemBody: css({
      padding: v1.spacing.md,
    }),
    stepHeading: css({
      fontSize: v1.typography.size.md,
    }),
    stepDescription: css({
      fontSize: v1.typography.size.sm,
      color: v1.colors.textWeak,
      marginBottom: v1.spacing.sm,
    }),
    step: css({
      marginBottom: v1.spacing.lg,

      '&:last-child': {
        marginBottom: 0,
      },
    }),
    bucket: css({
      display: 'flex',
      marginBottom: v1.spacing.sm,
      borderRadius: v1.border.radius.sm,
    }),
    bucketInterval: css({
      flexGrow: 0,
      width: '60px',
    }),
    bucketRetention: css({
      background: `linear-gradient(0deg, ${v1.palette.blue85}, ${v1.palette.blue95})`,
      textAlign: 'center',
      color: v1.palette.white,
      marginRight: v1.spacing.md,
      borderRadius: v1.border.radius.sm,
    }),
    bucketRetentionActive: css({
      background: `linear-gradient(0deg, ${v1.palette.greenBase}, ${v1.palette.greenShade})`,
    }),
  };
};
