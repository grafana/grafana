import { __extends, __makeTemplateObject, __values } from "tslib";
import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { rangeUtil } from '@grafana/data';
import { parseSchemaRetentions, getRollupNotice, getRuntimeConsolidationNotice } from '../meta';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
var MetricTankMetaInspector = /** @class */ (function (_super) {
    __extends(MetricTankMetaInspector, _super);
    function MetricTankMetaInspector() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    MetricTankMetaInspector.prototype.renderMeta = function (meta, key) {
        var _a;
        var styles = getStyles();
        var buckets = parseSchemaRetentions(meta['schema-retentions']);
        var rollupNotice = getRollupNotice([meta]);
        var runtimeNotice = getRuntimeConsolidationNotice([meta]);
        var normFunc = ((_a = meta['consolidator-normfetch']) !== null && _a !== void 0 ? _a : '').replace('Consolidator', '');
        var totalSeconds = buckets.reduce(function (acc, bucket) { return acc + (bucket.retention ? rangeUtil.intervalToSeconds(bucket.retention) : 0); }, 0);
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
                    React.createElement("div", null, buckets.map(function (bucket, index) {
                        var _a;
                        var bucketLength = bucket.retention ? rangeUtil.intervalToSeconds(bucket.retention) : 0;
                        var lengthPercent = (bucketLength / totalSeconds) * 100;
                        var isActive = index === meta['archive-read'];
                        return (React.createElement("div", { key: bucket.retention, className: styles.bucket },
                            React.createElement("div", { className: styles.bucketInterval }, bucket.interval),
                            React.createElement("div", { className: cx(styles.bucketRetention, (_a = {}, _a[styles.bucketRetentionActive] = isActive, _a)), style: { flexGrow: lengthPercent } }),
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
    };
    MetricTankMetaInspector.prototype.render = function () {
        var e_1, _a, e_2, _b;
        var _this = this;
        var data = this.props.data;
        // away to dedupe them
        var seriesMetas = {};
        try {
            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var series = data_1_1.value;
                if (series.meta && series.meta.custom) {
                    try {
                        for (var _c = (e_2 = void 0, __values(series.meta.custom.seriesMetaList)), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var metaItem = _d.value;
                            // key is to dedupe as many series will have identitical meta
                            var key = "" + JSON.stringify(metaItem);
                            if (seriesMetas[key]) {
                                seriesMetas[key].count += metaItem.count;
                            }
                            else {
                                seriesMetas[key] = metaItem;
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (Object.keys(seriesMetas).length === 0) {
            return React.createElement("div", null, "No response meta data");
        }
        return (React.createElement("div", null,
            React.createElement("h2", { className: "page-heading" }, "Metrictank Lineage"),
            Object.keys(seriesMetas).map(function (key) { return _this.renderMeta(seriesMetas[key], key); })));
    };
    return MetricTankMetaInspector;
}(PureComponent));
export { MetricTankMetaInspector };
var getStyles = stylesFactory(function () {
    var theme = config.theme;
    var borderColor = theme.isDark ? theme.palette.gray25 : theme.palette.gray85;
    var background = theme.isDark ? theme.palette.dark1 : theme.palette.white;
    var headerBg = theme.isDark ? theme.palette.gray15 : theme.palette.gray85;
    return {
        metaItem: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      background: ", ";\n      border: 1px solid ", ";\n      margin-bottom: ", ";\n    "], ["\n      background: ", ";\n      border: 1px solid ", ";\n      margin-bottom: ", ";\n    "])), background, borderColor, theme.spacing.md),
        metaItemHeader: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background: ", ";\n      padding: ", " ", ";\n      font-size: ", ";\n      display: flex;\n      justify-content: space-between;\n    "], ["\n      background: ", ";\n      padding: ", " ", ";\n      font-size: ", ";\n      display: flex;\n      justify-content: space-between;\n    "])), headerBg, theme.spacing.xs, theme.spacing.md, theme.typography.size.md),
        metaItemBody: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing.md),
        stepHeading: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      font-size: ", ";\n    "], ["\n      font-size: ", ";\n    "])), theme.typography.size.md),
        stepDescription: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      font-size: ", ";\n      color: ", ";\n      margin-bottom: ", ";\n    "], ["\n      font-size: ", ";\n      color: ", ";\n      margin-bottom: ", ";\n    "])), theme.typography.size.sm, theme.colors.textWeak, theme.spacing.sm),
        step: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin-bottom: ", ";\n\n      &:last-child {\n        margin-bottom: 0;\n      }\n    "], ["\n      margin-bottom: ", ";\n\n      &:last-child {\n        margin-bottom: 0;\n      }\n    "])), theme.spacing.lg),
        bucket: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      display: flex;\n      margin-bottom: ", ";\n      border-radius: ", ";\n    "], ["\n      display: flex;\n      margin-bottom: ", ";\n      border-radius: ", ";\n    "])), theme.spacing.sm, theme.border.radius.md),
        bucketInterval: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      flex-grow: 0;\n      width: 60px;\n    "], ["\n      flex-grow: 0;\n      width: 60px;\n    "]))),
        bucketRetention: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      background: linear-gradient(0deg, ", ", ", ");\n      text-align: center;\n      color: ", ";\n      margin-right: ", ";\n      border-radius: ", ";\n    "], ["\n      background: linear-gradient(0deg, ", ", ", ");\n      text-align: center;\n      color: ", ";\n      margin-right: ", ";\n      border-radius: ", ";\n    "])), theme.palette.blue85, theme.palette.blue95, theme.palette.white, theme.spacing.md, theme.border.radius.md),
        bucketRetentionActive: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      background: linear-gradient(0deg, ", ", ", ");\n    "], ["\n      background: linear-gradient(0deg, ", ", ", ");\n    "])), theme.palette.greenBase, theme.palette.greenShade),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=MetricTankMetaInspector.js.map