import { omitBy, isNil, isNumber, defaultTo, groupBy } from 'lodash';
import { FieldMatcherID, ThresholdsMode, FieldType, } from '@grafana/data';
/**
 * At 7.0, the `table` panel was swapped from an angular implementation to a react one.
 * The models do not match, so this process will delegate to the old implementation when
 * a saved table configuration exists.
 */
export const tableMigrationHandler = (panel) => {
    // Table was saved as an angular table, lets just swap to the 'table-old' panel
    if (!panel.pluginVersion && 'columns' in panel) {
        console.log('Was angular table', panel);
    }
    // Nothing changed
    return panel.options;
};
const transformsMap = {
    timeseries_to_rows: 'seriesToRows',
    timeseries_to_columns: 'seriesToColumns',
    timeseries_aggregations: 'reduce',
    table: 'merge',
};
const columnsMap = {
    avg: 'mean',
    min: 'min',
    max: 'max',
    total: 'sum',
    current: 'lastNotNull',
    count: 'count',
};
const colorModeMap = {
    cell: 'color-background',
    row: 'color-background',
    value: 'color-text',
};
const generateThresholds = (thresholds, colors) => {
    return [-Infinity, ...thresholds].map((threshold, idx) => ({
        color: colors[idx],
        value: isNumber(threshold) ? threshold : parseInt(threshold, 10),
    }));
};
const migrateTransformations = (panel, oldOpts) => {
    var _a;
    const transformations = (_a = panel.transformations) !== null && _a !== void 0 ? _a : [];
    if (Object.keys(transformsMap).includes(oldOpts.transform)) {
        const opts = {
            reducers: [],
        };
        if (oldOpts.transform === 'timeseries_aggregations') {
            opts.includeTimeField = false;
            opts.reducers = oldOpts.columns.map((column) => columnsMap[column.value]);
        }
        transformations.push({
            id: transformsMap[oldOpts.transform],
            options: opts,
        });
    }
    return transformations;
};
const migrateTableStyleToOverride = (style) => {
    var _a;
    const fieldMatcherId = /^\/.*\/$/.test(style.pattern) ? FieldMatcherID.byRegexp : FieldMatcherID.byName;
    const override = {
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
            value: `time: ${style.dateFormat}`,
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
            id: 'custom.cellOptions',
            value: {
                type: colorModeMap[style.colorMode],
            },
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
const migrateDefaults = (prevDefaults) => {
    let defaults = {
        custom: {},
    };
    if (prevDefaults) {
        defaults = omitBy({
            unit: prevDefaults.unit,
            decimals: prevDefaults.decimals,
            displayName: prevDefaults.alias,
            custom: {
                align: prevDefaults.align === 'auto' ? null : prevDefaults.align,
            },
        }, isNil);
        if (prevDefaults.thresholds.length) {
            const thresholds = {
                mode: ThresholdsMode.Absolute,
                steps: generateThresholds(prevDefaults.thresholds, prevDefaults.colors),
            };
            defaults.thresholds = thresholds;
        }
        if (prevDefaults.colorMode) {
            defaults.custom.cellOptions = {
                type: colorModeMap[prevDefaults.colorMode],
            };
        }
    }
    return defaults;
};
/**
 * This is called when the panel changes from another panel
 */
export const tablePanelChangedHandler = (panel, prevPluginId, prevOptions) => {
    // Changing from angular table panel
    if (prevPluginId === 'table-old' && prevOptions.angular) {
        const oldOpts = prevOptions.angular;
        const transformations = migrateTransformations(panel, oldOpts);
        const prevDefaults = oldOpts.styles.find((style) => style.pattern === '/.*/');
        const defaults = migrateDefaults(prevDefaults);
        const overrides = oldOpts.styles.filter((style) => style.pattern !== '/.*/').map(migrateTableStyleToOverride);
        panel.transformations = transformations;
        panel.fieldConfig = {
            defaults,
            overrides,
        };
    }
    return {};
};
const getMainFrames = (frames) => {
    return (frames === null || frames === void 0 ? void 0 : frames.filter((df) => { var _a, _b; return ((_b = (_a = df.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.parentRowIndex) === undefined; })) || [frames === null || frames === void 0 ? void 0 : frames[0]];
};
/**
 * In 9.3 meta.custom.parentRowIndex was introduced to support sub-tables.
 * In 10.2 meta.custom.parentRowIndex was deprecated in favor of FieldType.nestedFrames, which supports multiple nested frames.
 * Migrate DataFrame[] from using meta.custom.parentRowIndex to using FieldType.nestedFrames
 */
export const migrateFromParentRowIndexToNestedFrames = (frames) => {
    const migratedFrames = [];
    const mainFrames = getMainFrames(frames).filter((frame) => !!frame && frame.length !== 0);
    mainFrames === null || mainFrames === void 0 ? void 0 : mainFrames.forEach((frame) => {
        const subFrames = frames === null || frames === void 0 ? void 0 : frames.filter((df) => { var _a, _b; return frame.refId === df.refId && ((_b = (_a = df.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.parentRowIndex) !== undefined; });
        const subFramesGrouped = groupBy(subFrames, (frame) => { var _a, _b; return (_b = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.parentRowIndex; });
        const subFramesByIndex = Object.keys(subFramesGrouped).map((key) => subFramesGrouped[key]);
        const migratedFrame = Object.assign({}, frame);
        if (subFrames && subFrames.length > 0) {
            migratedFrame.fields.push({
                name: 'nested',
                type: FieldType.nestedFrames,
                config: {},
                values: subFramesByIndex,
            });
        }
        migratedFrames.push(migratedFrame);
    });
    return migratedFrames;
};
export const hasDeprecatedParentRowIndex = (frames) => {
    return frames === null || frames === void 0 ? void 0 : frames.some((df) => { var _a, _b; return ((_b = (_a = df.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.parentRowIndex) !== undefined; });
};
//# sourceMappingURL=migrations.js.map