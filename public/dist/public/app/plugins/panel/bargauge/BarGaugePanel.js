import { isNumber } from 'lodash';
import React, { PureComponent } from 'react';
import { getDisplayValueAlignmentFactors, getFieldDisplayValues, VizOrientation, } from '@grafana/data';
import { BarGauge, DataLinksContextMenu, VizRepeater } from '@grafana/ui';
import { config } from 'app/core/config';
export class BarGaugePanel extends PureComponent {
    constructor() {
        super(...arguments);
        this.renderComponent = (valueProps, menuProps) => {
            const { options, fieldConfig } = this.props;
            const { value, alignmentFactors, orientation, width, height, count } = valueProps;
            const { field, display, view, colIndex } = value;
            const { openMenu, targetClassName } = menuProps;
            let processor = undefined;
            if (view && isNumber(colIndex)) {
                processor = view.getFieldDisplayProcessor(colIndex);
            }
            return (React.createElement(BarGauge, { value: clearNameForSingleSeries(count, fieldConfig.defaults, display), width: width, height: height, orientation: orientation, field: field, text: options.text, display: processor, theme: config.theme2, itemSpacing: this.getItemSpacing(), displayMode: options.displayMode, onClick: openMenu, className: targetClassName, alignmentFactors: count > 1 ? alignmentFactors : undefined, showUnfilled: options.showUnfilled, valueDisplayMode: options.valueMode, namePlacement: options.namePlacement }));
        };
        this.renderValue = (valueProps) => {
            const { value, orientation } = valueProps;
            const { hasLinks, getLinks } = value;
            if (hasLinks && getLinks) {
                return (React.createElement("div", { style: { width: '100%', display: orientation === VizOrientation.Vertical ? 'flex' : 'initial' } },
                    React.createElement(DataLinksContextMenu, { style: { height: '100%' }, links: getLinks }, (api) => this.renderComponent(valueProps, api))));
            }
            return this.renderComponent(valueProps, {});
        };
        this.getValues = () => {
            const { data, options, replaceVariables, fieldConfig, timeZone } = this.props;
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
    getItemSpacing() {
        if (this.props.options.displayMode === 'lcd') {
            return 2;
        }
        return 10;
    }
    render() {
        const { height, width, options, data, renderCounter } = this.props;
        return (React.createElement(VizRepeater, { source: data, getAlignmentFactors: getDisplayValueAlignmentFactors, getValues: this.getValues, renderValue: this.renderValue, renderCounter: renderCounter, width: width, height: height, minVizWidth: options.minVizWidth, minVizHeight: options.minVizHeight, itemSpacing: this.getItemSpacing(), orientation: options.orientation }));
    }
}
export function clearNameForSingleSeries(count, field, display) {
    if (count === 1 && !field.displayName) {
        return Object.assign(Object.assign({}, display), { title: undefined });
    }
    return display;
}
//# sourceMappingURL=BarGaugePanel.js.map