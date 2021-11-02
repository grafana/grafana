import { __values } from "tslib";
import { FieldColorModeId, FieldConfigProperty, FieldMatcherID } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { PieChartLabels, PieChartLegendValues, PieChartType } from './types';
export var PieChartPanelChangedHandler = function (panel, prevPluginId, prevOptions) {
    var e_1, _a;
    if (prevPluginId === 'grafana-piechart-panel' && prevOptions.angular) {
        var angular_1 = prevOptions.angular;
        var overrides = [];
        var options = panel.options;
        // Migrate color overrides for series
        if (angular_1.aliasColors) {
            try {
                for (var _b = __values(Object.keys(angular_1.aliasColors)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var alias = _c.value;
                    var color = angular_1.aliasColors[alias];
                    if (color) {
                        overrides.push({
                            matcher: {
                                id: FieldMatcherID.byName,
                                options: alias,
                            },
                            properties: [
                                {
                                    id: FieldConfigProperty.Color,
                                    value: {
                                        mode: FieldColorModeId.Fixed,
                                        fixedColor: color,
                                    },
                                },
                            ],
                        });
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        panel.fieldConfig = {
            overrides: overrides,
            defaults: {
                unit: angular_1.format,
                decimals: angular_1.decimals ? angular_1.decimals : 0, // Old piechart defaults to 0 decimals while the new one defaults to 1
            },
        };
        options.legend = { placement: 'right', values: [], displayMode: LegendDisplayMode.Table, calcs: [] };
        if (angular_1.valueName) {
            options.reduceOptions = { calcs: [] };
            switch (angular_1.valueName) {
                case 'current':
                    options.reduceOptions.calcs = ['lastNotNull'];
                    break;
                case 'min':
                    options.reduceOptions.calcs = ['min'];
                    break;
                case 'max':
                    options.reduceOptions.calcs = ['max'];
                    break;
                case 'avg':
                    options.reduceOptions.calcs = ['mean'];
                    break;
                case 'total':
                    options.reduceOptions.calcs = ['sum'];
                    break;
            }
        }
        switch (angular_1.legendType) {
            case 'Under graph':
                options.legend.placement = 'bottom';
                break;
            case 'Right side':
                options.legend.placement = 'right';
                break;
        }
        switch (angular_1.pieType) {
            case 'pie':
                options.pieType = PieChartType.Pie;
                break;
            case 'donut':
                options.pieType = PieChartType.Donut;
                break;
        }
        if (angular_1.legend) {
            if (!angular_1.legend.show) {
                options.legend.displayMode = LegendDisplayMode.Hidden;
            }
            if (angular_1.legend.values) {
                options.legend.values.push(PieChartLegendValues.Value);
            }
            if (angular_1.legend.percentage) {
                options.legend.values.push(PieChartLegendValues.Percent);
            }
            if (!angular_1.legend.percentage && !angular_1.legend.values) {
                // If you deselect both value and percentage in the old pie chart plugin, the legend is hidden.
                options.legend.displayMode = LegendDisplayMode.Hidden;
            }
        }
        // Set up labels when the old piechart is using 'on graph', for the legend option.
        if (angular_1.legendType === 'On graph') {
            options.legend.displayMode = LegendDisplayMode.Hidden;
            options.displayLabels = [PieChartLabels.Name];
            if (angular_1.legend.values) {
                options.displayLabels.push(PieChartLabels.Value);
            }
            if (angular_1.legend.percentage) {
                options.displayLabels.push(PieChartLabels.Percent);
            }
        }
        return options;
    }
    return {};
};
//# sourceMappingURL=migrations.js.map