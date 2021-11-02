import { __read, __spreadArray } from "tslib";
import { FieldMatcherID, ThresholdsMode, } from '@grafana/data';
import { omitBy, isNil, isNumber, defaultTo } from 'lodash';
/**
 * At 7.0, the `table` panel was swapped from an angular implementation to a react one.
 * The models do not match, so this process will delegate to the old implementation when
 * a saved table configuration exists.
 */
export var tableMigrationHandler = function (panel) {
    // Table was saved as an angular table, lets just swap to the 'table-old' panel
    if (!panel.pluginVersion && panel.columns) {
        console.log('Was angular table', panel);
    }
    // Nothing changed
    return panel.options;
};
var transformsMap = {
    timeseries_to_rows: 'seriesToRows',
    timeseries_to_columns: 'seriesToColumns',
    timeseries_aggregations: 'reduce',
    table: 'merge',
};
var columnsMap = {
    avg: 'mean',
    min: 'min',
    max: 'max',
    total: 'sum',
    current: 'last',
    count: 'count',
};
var colorModeMap = {
    cell: 'color-background',
    row: 'color-background',
    value: 'color-text',
};
var generateThresholds = function (thresholds, colors) {
    return __spreadArray([-Infinity], __read(thresholds), false).map(function (threshold, idx) { return ({
        color: colors[idx],
        value: isNumber(threshold) ? threshold : parseInt(threshold, 10),
    }); });
};
var migrateTransformations = function (panel, oldOpts) {
    var _a;
    var transformations = (_a = panel.transformations) !== null && _a !== void 0 ? _a : [];
    if (Object.keys(transformsMap).includes(oldOpts.transform)) {
        var opts = {
            reducers: [],
        };
        if (oldOpts.transform === 'timeseries_aggregations') {
            opts.includeTimeField = false;
            opts.reducers = oldOpts.columns.map(function (column) { return columnsMap[column.value]; });
        }
        transformations.push({
            id: transformsMap[oldOpts.transform],
            options: opts,
        });
    }
    return transformations;
};
var migrateTableStyleToOverride = function (style) {
    var _a;
    var fieldMatcherId = /^\/.*\/$/.test(style.pattern) ? FieldMatcherID.byRegexp : FieldMatcherID.byName;
    var override = {
        matcher: {
            id: fieldMatcherId,
            options: style.pattern,
        },
        properties: [],
    };
    if (style.alias) {
        override.properties.push({
            id: 'displayName',
            value: style.alias,
        });
    }
    if (style.unit) {
        override.properties.push({
            id: 'unit',
            value: style.unit,
        });
    }
    if (style.decimals) {
        override.properties.push({
            id: 'decimals',
            value: style.decimals,
        });
    }
    if (style.type === 'date') {
        override.properties.push({
            id: 'unit',
            value: "time: " + style.dateFormat,
        });
    }
    if (style.link) {
        override.properties.push({
            id: 'links',
            value: [
                {
                    title: defaultTo(style.linkTooltip, ''),
                    url: defaultTo(style.linkUrl, ''),
                    targetBlank: defaultTo(style.linkTargetBlank, false),
                },
            ],
        });
    }
    if (style.colorMode) {
        override.properties.push({
            id: 'custom.displayMode',
            value: colorModeMap[style.colorMode],
        });
    }
    if (style.align) {
        override.properties.push({
            id: 'custom.align',
            value: style.align === 'auto' ? null : style.align,
        });
    }
    if ((_a = style.thresholds) === null || _a === void 0 ? void 0 : _a.length) {
        override.properties.push({
            id: 'thresholds',
            value: {
                mode: ThresholdsMode.Absolute,
                steps: generateThresholds(style.thresholds, style.colors),
            },
        });
    }
    return override;
};
var migrateDefaults = function (prevDefaults) {
    var defaults = {
        custom: {},
    };
    if (prevDefaults) {
        defaults = omitBy({
            unit: prevDefaults.unit,
            decimals: prevDefaults.decimals,
            displayName: prevDefaults.alias,
            custom: {
                align: prevDefaults.align === 'auto' ? null : prevDefaults.align,
                displayMode: colorModeMap[prevDefaults.colorMode],
            },
        }, isNil);
        if (prevDefaults.thresholds.length) {
            var thresholds = {
                mode: ThresholdsMode.Absolute,
                steps: generateThresholds(prevDefaults.thresholds, prevDefaults.colors),
            };
            defaults.thresholds = thresholds;
        }
    }
    return defaults;
};
/**
 * This is called when the panel changes from another panel
 */
export var tablePanelChangedHandler = function (panel, prevPluginId, prevOptions) {
    // Changing from angular table panel
    if (prevPluginId === 'table-old' && prevOptions.angular) {
        var oldOpts = prevOptions.angular;
        var transformations = migrateTransformations(panel, oldOpts);
        var prevDefaults = oldOpts.styles.find(function (style) { return style.pattern === '/.*/'; });
        var defaults = migrateDefaults(prevDefaults);
        var overrides = oldOpts.styles.filter(function (style) { return style.pattern !== '/.*/'; }).map(migrateTableStyleToOverride);
        panel.transformations = transformations;
        panel.fieldConfig = {
            defaults: defaults,
            overrides: overrides,
        };
    }
    return {};
};
//# sourceMappingURL=migrations.js.map