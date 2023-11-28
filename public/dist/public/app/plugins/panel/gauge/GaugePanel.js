import React, { PureComponent } from 'react';
import { getDisplayProcessor, getFieldDisplayValues } from '@grafana/data';
import { DataLinksContextMenu, Gauge, VizRepeater } from '@grafana/ui';
import { config } from 'app/core/config';
import { clearNameForSingleSeries } from '../bargauge/BarGaugePanel';
export class GaugePanel extends PureComponent {
    constructor() {
        super(...arguments);
        this.renderComponent = (valueProps, menuProps) => {
            const { options, fieldConfig } = this.props;
            const { width, height, count, value } = valueProps;
            const { field, display } = value;
            const { openMenu, targetClassName } = menuProps;
            return (React.createElement(Gauge, { value: clearNameForSingleSeries(count, fieldConfig.defaults, display), width: width, height: height, field: field, text: options.text, showThresholdLabels: options.showThresholdLabels, showThresholdMarkers: options.showThresholdMarkers, theme: config.theme2, onClick: openMenu, className: targetClassName, orientation: options.orientation }));
        };
        this.renderValue = (valueProps) => {
            const { value } = valueProps;
            const { getLinks, hasLinks } = value;
            if (hasLinks && getLinks) {
                return (React.createElement(DataLinksContextMenu, { links: getLinks, style: { flexGrow: 1 } }, (api) => {
                    return this.renderComponent(valueProps, api);
                }));
            }
            return this.renderComponent(valueProps, {});
        };
        this.getValues = () => {
            var _a, _b, _c;
            const { data, options, replaceVariables, fieldConfig, timeZone } = this.props;
            for (let frame of data.series) {
                for (let field of frame.fields) {
                    // Set the Min/Max value automatically for percent and percentunit
                    if (field.config.unit === 'percent' || field.config.unit === 'percentunit') {
                        const min = (_a = field.config.min) !== null && _a !== void 0 ? _a : 0;
                        const max = (_b = field.config.max) !== null && _b !== void 0 ? _b : (field.config.unit === 'percent' ? 100 : 1);
                        field.state = (_c = field.state) !== null && _c !== void 0 ? _c : {};
                        field.state.range = { min, max, delta: max - min };
                        field.display = getDisplayProcessor({ field, theme: config.theme2 });
                    }
                }
            }
            return getFieldDisplayValues({
                fieldConfig,
                reduceOptions: options.reduceOptions,
                replaceVariables,
                theme: config.theme2,
                data: data.series,
                timeZone,
            });
        };
    }
    render() {
        const { height, width, data, renderCounter, options } = this.props;
        return (React.createElement(VizRepeater, { getValues: this.getValues, renderValue: this.renderValue, width: width, height: height, source: data, autoGrid: true, renderCounter: renderCounter, orientation: options.orientation, minVizHeight: options.minVizHeight, minVizWidth: options.minVizWidth }));
    }
}
//# sourceMappingURL=GaugePanel.js.map