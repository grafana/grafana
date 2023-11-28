import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { rangeUtil } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { getRollupNotice, getRuntimeConsolidationNotice, parseSchemaRetentions } from '../meta';
export class MetricTankMetaInspector extends PureComponent {
    renderMeta(meta, key) {
        var _a;
        const styles = getStyles();
        const buckets = parseSchemaRetentions(meta['schema-retentions']);
        const rollupNotice = getRollupNotice([meta]);
        const runtimeNotice = getRuntimeConsolidationNotice([meta]);
        const normFunc = ((_a = meta['consolidator-normfetch']) !== null && _a !== void 0 ? _a : '').replace('Consolidator', '');
        const totalSeconds = buckets.reduce((acc, bucket) => acc + (bucket.retention ? rangeUtil.intervalToSeconds(bucket.retention) : 0), 0);
        return (React.createElement("div", { className: styles.metaItem, key: key },
            React.createElement("div", { className: styles.metaItemHeader },
                "Schema: ",
                meta['schema-name'],
                React.createElement("div", { className: "small muted" },
                    "Series count: ",
                    meta.count)),
            React.createElement("div", { className: styles.metaItemBody },
                React.createElement("div", { className: styles.step },
                    React.createElement("div", { className: styles.stepHeading }, "Step 1: Fetch"),
                    React.createElement("div", { className: styles.stepDescription }, "First data is fetched, either from raw data archive or a rollup archive"),
                    rollupNotice && React.createElement("p", null, rollupNotice.text),
                    !rollupNotice && React.createElement("p", null, "No rollup archive was used"),
                    React.createElement("div", null, buckets.map((bucket, index) => {
                        const bucketLength = bucket.retention ? rangeUtil.intervalToSeconds(bucket.retention) : 0;
                        const lengthPercent = (bucketLength / totalSeconds) * 100;
                        const isActive = index === meta['archive-read'];
                        return (React.createElement("div", { key: bucket.retention, className: styles.bucket },
                            React.createElement("div", { className: styles.bucketInterval }, bucket.interval),
                            React.createElement("div", { className: cx(styles.bucketRetention, { [styles.bucketRetentionActive]: isActive }), style: { flexGrow: lengthPercent } }),
                            React.createElement("div", { style: { flexGrow: 100 - lengthPercent } }, bucket.retention)));
                    }))),
                React.createElement("div", { className: styles.step },
                    React.createElement("div", { className: styles.stepHeading }, "Step 2: Normalization"),
                    React.createElement("div", { className: styles.stepDescription }, "Normalization happens when series with different intervals between points are combined."),
                    meta['aggnum-norm'] > 1 && React.createElement("p", null,
                        "Normalization did occur using ",
                        normFunc),
                    meta['aggnum-norm'] === 1 && React.createElement("p", null, "No normalization was needed")),
                React.createElement("div", { className: styles.step },
                    React.createElement("div", { className: styles.stepHeading }, "Step 3: Runtime consolidation"),
                    React.createElement("div", { className: styles.stepDescription }, "If there are too many data points at this point Metrictank will consolidate them down to below max data points (set in queries tab)."),
                    runtimeNotice && React.createElement("p", null, runtimeNotice.text),
                    !runtimeNotice && React.createElement("p", null, "No runtime consolidation")))));
    }
    render() {
        var _a, _b;
        const { data } = this.props;
        // away to dedupe them
        const seriesMetas = {};
        for (const series of data) {
            if ((_b = (_a = series === null || series === void 0 ? void 0 : series.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.seriesMetaList) {
                for (const metaItem of series.meta.custom.seriesMetaList) {
                    // key is to dedupe as many series will have identitical meta
                    const key = `${JSON.stringify(metaItem)}`;
                    if (seriesMetas[key]) {
                        seriesMetas[key].count += metaItem.count;
                    }
                    else {
                        seriesMetas[key] = metaItem;
                    }
                }
            }
        }
        if (Object.keys(seriesMetas).length === 0) {
            return React.createElement("div", null, "No response meta data");
        }
        return (React.createElement("div", null,
            React.createElement("h2", { className: "page-heading" }, "Metrictank Lineage"),
            Object.keys(seriesMetas).map((key) => this.renderMeta(seriesMetas[key], key))));
    }
}
const getStyles = stylesFactory(() => {
    const { theme } = config;
    const borderColor = theme.isDark ? theme.palette.gray25 : theme.palette.gray85;
    const background = theme.isDark ? theme.palette.dark1 : theme.palette.white;
    const headerBg = theme.isDark ? theme.palette.gray15 : theme.palette.gray85;
    return {
        metaItem: css `
      background: ${background};
      border: 1px solid ${borderColor};
      margin-bottom: ${theme.spacing.md};
    `,
        metaItemHeader: css `
      background: ${headerBg};
      padding: ${theme.spacing.xs} ${theme.spacing.md};
      font-size: ${theme.typography.size.md};
      display: flex;
      justify-content: space-between;
    `,
        metaItemBody: css `
      padding: ${theme.spacing.md};
    `,
        stepHeading: css `
      font-size: ${theme.typography.size.md};
    `,
        stepDescription: css `
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
      margin-bottom: ${theme.spacing.sm};
    `,
        step: css `
      margin-bottom: ${theme.spacing.lg};

      &:last-child {
        margin-bottom: 0;
      }
    `,
        bucket: css `
      display: flex;
      margin-bottom: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
    `,
        bucketInterval: css `
      flex-grow: 0;
      width: 60px;
    `,
        bucketRetention: css `
      background: linear-gradient(0deg, ${theme.palette.blue85}, ${theme.palette.blue95});
      text-align: center;
      color: ${theme.palette.white};
      margin-right: ${theme.spacing.md};
      border-radius: ${theme.border.radius.sm};
    `,
        bucketRetentionActive: css `
      background: linear-gradient(0deg, ${theme.palette.greenBase}, ${theme.palette.greenShade});
    `,
    };
});
//# sourceMappingURL=MetricTankMetaInspector.js.map