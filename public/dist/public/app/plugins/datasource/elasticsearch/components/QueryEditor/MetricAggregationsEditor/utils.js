import { __read, __spreadArray } from "tslib";
import { isMetricAggregationWithField, isPipelineAggregationWithMultipleBucketPaths, } from './aggregations';
import { defaultPipelineVariable, generatePipelineVariableName, } from './SettingsEditor/BucketScriptSettingsEditor/utils';
export var metricAggregationConfig = {
    count: {
        label: 'Count',
        requiresField: false,
        isPipelineAgg: false,
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: false,
        hasMeta: false,
        supportsInlineScript: false,
        defaults: {},
    },
    avg: {
        label: 'Average',
        requiresField: true,
        supportsInlineScript: true,
        supportsMissing: true,
        isPipelineAgg: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        hasMeta: false,
        defaults: {},
    },
    sum: {
        label: 'Sum',
        requiresField: true,
        supportsInlineScript: true,
        supportsMissing: true,
        isPipelineAgg: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        hasMeta: false,
        defaults: {},
    },
    max: {
        label: 'Max',
        requiresField: true,
        supportsInlineScript: true,
        supportsMissing: true,
        isPipelineAgg: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        hasMeta: false,
        defaults: {},
    },
    min: {
        label: 'Min',
        requiresField: true,
        supportsInlineScript: true,
        supportsMissing: true,
        isPipelineAgg: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        hasMeta: false,
        defaults: {},
    },
    extended_stats: {
        label: 'Extended Stats',
        requiresField: true,
        supportsMissing: true,
        supportsInlineScript: true,
        isPipelineAgg: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        hasMeta: true,
        defaults: {
            meta: {
                std_deviation_bounds_lower: true,
                std_deviation_bounds_upper: true,
            },
        },
    },
    percentiles: {
        label: 'Percentiles',
        requiresField: true,
        supportsMissing: true,
        supportsInlineScript: true,
        isPipelineAgg: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        hasMeta: false,
        defaults: {
            settings: {
                percents: ['25', '50', '75', '95', '99'],
            },
        },
    },
    cardinality: {
        label: 'Unique Count',
        requiresField: true,
        supportsMissing: true,
        isPipelineAgg: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {},
    },
    moving_avg: {
        label: 'Moving Average',
        requiresField: true,
        isPipelineAgg: true,
        versionRange: '>=2.0.0',
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {
            settings: {
                model: 'simple',
                window: '5',
            },
        },
    },
    moving_fn: {
        // TODO: Check this
        label: 'Moving Function',
        requiresField: true,
        isPipelineAgg: true,
        supportsMultipleBucketPaths: false,
        supportsInlineScript: false,
        supportsMissing: false,
        hasMeta: false,
        hasSettings: true,
        versionRange: '>=7.0.0',
        defaults: {},
    },
    derivative: {
        label: 'Derivative',
        requiresField: true,
        isPipelineAgg: true,
        versionRange: '>=2.0.0',
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {},
    },
    serial_diff: {
        label: 'Serial Difference',
        requiresField: true,
        isPipelineAgg: true,
        versionRange: '>=2.0.0',
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {
            settings: {
                lag: '1',
            },
        },
    },
    cumulative_sum: {
        label: 'Cumulative Sum',
        requiresField: true,
        isPipelineAgg: true,
        versionRange: '>=2.0.0',
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {},
    },
    bucket_script: {
        label: 'Bucket Script',
        requiresField: false,
        isPipelineAgg: true,
        supportsMissing: false,
        supportsMultipleBucketPaths: true,
        versionRange: '>=2.0.0',
        hasSettings: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {
            pipelineVariables: [defaultPipelineVariable(generatePipelineVariableName([]))],
        },
    },
    raw_document: {
        label: 'Raw Document (legacy)',
        requiresField: false,
        isSingleMetric: true,
        isPipelineAgg: false,
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {
            settings: {
                size: '500',
            },
        },
    },
    raw_data: {
        label: 'Raw Data',
        requiresField: false,
        isSingleMetric: true,
        isPipelineAgg: false,
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {
            settings: {
                size: '500',
            },
        },
    },
    logs: {
        label: 'Logs',
        requiresField: false,
        isPipelineAgg: false,
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        isSingleMetric: true,
        supportsInlineScript: false,
        hasMeta: false,
        defaults: {
            settings: {
                limit: '500',
            },
        },
    },
    top_metrics: {
        label: 'Top Metrics',
        xpack: true,
        requiresField: false,
        isPipelineAgg: false,
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: false,
        versionRange: '>=7.7.0',
        hasMeta: false,
        defaults: {
            settings: {
                order: 'desc',
            },
        },
    },
    rate: {
        label: 'Rate',
        xpack: true,
        versionRange: '>=7.10.0',
        requiresField: true,
        isPipelineAgg: false,
        supportsMissing: false,
        supportsMultipleBucketPaths: false,
        hasSettings: true,
        supportsInlineScript: true,
        hasMeta: false,
        defaults: {},
    },
};
export var pipelineOptions = {
    moving_avg: [
        { label: 'window', default: 5 },
        { label: 'model', default: 'simple' },
        { label: 'predict' },
        { label: 'minimize', default: false },
    ],
    moving_fn: [{ label: 'window', default: 5 }, { label: 'script' }],
    derivative: [{ label: 'unit' }],
    serial_diff: [{ label: 'lag' }],
    cumulative_sum: [{ label: 'format' }],
    bucket_script: [],
};
/**
 * Given a metric `MetricA` and an array of metrics, returns all children of `MetricA`.
 * `MetricB` is considered a child of `MetricA` if `MetricA` is referenced by `MetricB` in it's `field` attribute
 * (`MetricA.id === MetricB.field`) or in it's pipeline aggregation variables (for bucket_scripts).
 * @param metric
 * @param metrics
 */
export var getChildren = function (metric, metrics) {
    var children = metrics.filter(function (m) {
        var _a;
        // TODO: Check this.
        if (isPipelineAggregationWithMultipleBucketPaths(m)) {
            return (_a = m.pipelineVariables) === null || _a === void 0 ? void 0 : _a.some(function (pv) { return pv.pipelineAgg === metric.id; });
        }
        return isMetricAggregationWithField(m) && metric.id === m.field;
    });
    return __spreadArray(__spreadArray([], __read(children), false), __read(children.flatMap(function (child) { return getChildren(child, metrics); })), false);
};
//# sourceMappingURL=utils.js.map