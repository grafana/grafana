import { isNumber } from 'lodash';
import React, { PureComponent } from 'react';
import { FieldType, getDisplayValueAlignmentFactors, getFieldDisplayValues, } from '@grafana/data';
import { findNumericFieldMinMax } from '@grafana/data/src/field/fieldOverrides';
import { BigValueTextMode, BigValueGraphMode } from '@grafana/schema';
import { BigValue, DataLinksContextMenu, VizRepeater } from '@grafana/ui';
import { config } from 'app/core/config';
export class StatPanel extends PureComponent {
    constructor() {
        super(...arguments);
        this.renderComponent = (valueProps, menuProps) => {
            const { timeRange, options } = this.props;
            const { value, alignmentFactors, width, height, count, orientation } = valueProps;
            const { openMenu, targetClassName } = menuProps;
            let sparkline = value.sparkline;
            if (sparkline) {
                sparkline.timeRange = timeRange;
            }
            return (React.createElement(BigValue, { value: value.display, count: count, sparkline: sparkline, colorMode: options.colorMode, graphMode: options.graphMode, justifyMode: options.justifyMode, textMode: this.getTextMode(), alignmentFactors: alignmentFactors, parentOrientation: orientation, text: options.text, width: width, height: height, theme: config.theme2, onClick: openMenu, className: targetClassName, disableWideLayout: true }));
        };
        this.renderValue = (valueProps) => {
            const { value } = valueProps;
            const { getLinks, hasLinks } = value;
            if (hasLinks && getLinks) {
                return (React.createElement(DataLinksContextMenu, { links: getLinks }, (api) => {
                    return this.renderComponent(valueProps, api);
                }));
            }
            return this.renderComponent(valueProps, {});
        };
        this.getValues = () => {
            var _a, _b, _c, _d;
            const { data, options, replaceVariables, fieldConfig, timeZone } = this.props;
            let globalRange = undefined;
            for (let frame of data.series) {
                for (let field of frame.fields) {
                    let { config } = field;
                    // mostly copied from fieldOverrides, since they are skipped during streaming
                    // Set the Min/Max value automatically
                    if (field.type === FieldType.number) {
                        if ((_a = field.state) === null || _a === void 0 ? void 0 : _a.range) {
                            continue;
                        }
                        if (!globalRange && (!isNumber(config.min) || !isNumber(config.max))) {
                            globalRange = findNumericFieldMinMax(data.series);
                        }
                        const min = (_b = config.min) !== null && _b !== void 0 ? _b : globalRange.min;
                        const max = (_c = config.max) !== null && _c !== void 0 ? _c : globalRange.max;
                        field.state = (_d = field.state) !== null && _d !== void 0 ? _d : {};
                        field.state.range = { min, max, delta: max - min };
                    }
                }
            }
            return getFieldDisplayValues({
                fieldConfig,
                reduceOptions: options.reduceOptions,
                replaceVariables,
                theme: config.theme2,
                data: data.series,
                sparkline: options.graphMode !== BigValueGraphMode.None,
                timeZone,
            });
        };
    }
    getTextMode() {
        const { options, fieldConfig, title } = this.props;
        // If we have manually set displayName or panel title switch text mode to value and name
        if (options.textMode === BigValueTextMode.Auto && (fieldConfig.defaults.displayName || !title)) {
            return BigValueTextMode.ValueAndName;
        }
        return options.textMode;
    }
    render() {
        const { height, options, width, data, renderCounter } = this.props;
        return (React.createElement(VizRepeater, { getValues: this.getValues, getAlignmentFactors: getDisplayValueAlignmentFactors, renderValue: this.renderValue, width: width, height: height, source: data, itemSpacing: 3, renderCounter: renderCounter, autoGrid: true, orientation: options.orientation }));
    }
}
//# sourceMappingURL=StatPanel.js.map