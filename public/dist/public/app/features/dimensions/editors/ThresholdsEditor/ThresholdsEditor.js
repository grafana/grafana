import { __rest } from "tslib";
import { css } from '@emotion/css';
import { isNumber } from 'lodash';
import React, { PureComponent } from 'react';
import { sortThresholds, ThresholdsMode, ThemeContext, } from '@grafana/data';
import { Button, ColorPicker, colors, IconButton, Input, Label, RadioButtonGroup, stylesFactory } from '@grafana/ui';
const modes = [
    { value: ThresholdsMode.Absolute, label: 'Absolute', description: 'Pick thresholds based on the absolute values' },
    {
        value: ThresholdsMode.Percentage,
        label: 'Percentage',
        description: 'Pick threshold based on the percent between min/max',
    },
];
export class ThresholdsEditor extends PureComponent {
    constructor(props) {
        super(props);
        this.onAddThreshold = () => {
            const { steps } = this.state;
            let nextValue = 0;
            if (steps.length > 1) {
                nextValue = steps[steps.length - 1].value + 10;
            }
            let color = colors.filter((c) => !steps.some((t) => t.color === c))[1];
            if (!color) {
                // Default color when all colors are used
                color = '#CCCCCC';
            }
            const add = {
                value: nextValue,
                color: color,
                key: counter++,
            };
            const newThresholds = [...steps, add];
            sortThresholds(newThresholds);
            this.setState({ steps: newThresholds }, () => {
                if (this.latestThresholdInputRef.current) {
                    this.latestThresholdInputRef.current.focus();
                }
                this.onChange();
            });
        };
        this.onRemoveThreshold = (threshold) => {
            const { steps } = this.state;
            if (!steps.length) {
                return;
            }
            // Don't remove index 0
            if (threshold.key === steps[0].key) {
                return;
            }
            this.setState({ steps: steps.filter((t) => t.key !== threshold.key) }, this.onChange);
        };
        this.onChangeThresholdValue = (event, threshold) => {
            const cleanValue = event.target.value.replace(/,/g, '.');
            const parsedValue = parseFloat(cleanValue);
            const value = isNaN(parsedValue) ? '' : parsedValue;
            const steps = this.state.steps.map((t) => {
                if (t.key === threshold.key) {
                    t = Object.assign(Object.assign({}, t), { value: value });
                }
                return t;
            });
            if (steps.length) {
                steps[0].value = -Infinity;
            }
            sortThresholds(steps);
            this.setState({ steps });
        };
        this.onChangeThresholdColor = (threshold, color) => {
            const { steps } = this.state;
            const newThresholds = steps.map((t) => {
                if (t.key === threshold.key) {
                    t = Object.assign(Object.assign({}, t), { color: color });
                }
                return t;
            });
            this.setState({ steps: newThresholds }, this.onChange);
        };
        this.onBlur = () => {
            const steps = [...this.state.steps];
            sortThresholds(steps);
            this.setState({ steps }, this.onChange);
        };
        this.onChange = () => {
            this.props.onChange(thresholdsWithoutKey(this.props.thresholds, this.state.steps));
        };
        this.onModeChanged = (value) => {
            this.props.onChange(Object.assign(Object.assign({}, this.props.thresholds), { mode: value }));
        };
        const steps = toThresholdsWithKey(props.thresholds.steps);
        steps[0].value = -Infinity;
        this.state = { steps };
        this.latestThresholdInputRef = React.createRef();
    }
    renderInput(threshold, styles, idx) {
        const isPercent = this.props.thresholds.mode === ThresholdsMode.Percentage;
        const ariaLabel = `Threshold ${idx + 1}`;
        if (!isFinite(threshold.value)) {
            return (React.createElement(Input, { type: "text", value: 'Base', "aria-label": ariaLabel, disabled: true, prefix: React.createElement("div", { className: styles.colorPicker },
                    React.createElement(ColorPicker, { color: threshold.color, onChange: (color) => this.onChangeThresholdColor(threshold, color), enableNamedColors: true })) }));
        }
        return (React.createElement(Input, { type: "number", step: "0.0001", key: isPercent.toString(), onChange: (event) => this.onChangeThresholdValue(event, threshold), value: threshold.value, "aria-label": ariaLabel, ref: idx === 0 ? this.latestThresholdInputRef : null, onBlur: this.onBlur, prefix: React.createElement("div", { className: styles.inputPrefix },
                React.createElement("div", { className: styles.colorPicker },
                    React.createElement(ColorPicker, { color: threshold.color, onChange: (color) => this.onChangeThresholdColor(threshold, color), enableNamedColors: true })),
                isPercent && React.createElement("div", { className: styles.percentIcon }, "%")), suffix: React.createElement(IconButton, { className: styles.trashIcon, name: "trash-alt", onClick: () => this.onRemoveThreshold(threshold), tooltip: `Remove ${ariaLabel}` }) }));
    }
    render() {
        const { thresholds } = this.props;
        const { steps } = this.state;
        return (React.createElement(ThemeContext.Consumer, null, (theme) => {
            const styles = getStyles(theme);
            return (React.createElement("div", { className: styles.wrapper },
                React.createElement(Button, { size: "sm", icon: "plus", onClick: () => this.onAddThreshold(), variant: "secondary", className: styles.addButton, fullWidth: true }, "Add threshold"),
                React.createElement("div", { className: styles.thresholds }, steps
                    .slice(0)
                    .reverse()
                    .map((threshold, idx) => (React.createElement("div", { className: styles.item, key: `${threshold.key}` }, this.renderInput(threshold, styles, idx))))),
                React.createElement("div", null,
                    React.createElement(Label, { description: "Percentage means thresholds relative to min & max" }, "Thresholds mode"),
                    React.createElement(RadioButtonGroup, { options: modes, onChange: this.onModeChanged, value: thresholds.mode }))));
        }));
    }
}
let counter = 100;
function toThresholdsWithKey(steps) {
    if (!steps || steps.length === 0) {
        steps = [{ value: -Infinity, color: 'green' }];
    }
    return steps
        .filter((t, i) => isNumber(t.value) || i === 0)
        .map((t) => {
        return {
            color: t.color,
            value: t.value === null ? -Infinity : t.value,
            key: counter++,
        };
    });
}
export function thresholdsWithoutKey(thresholds, steps) {
    var _a;
    const mode = (_a = thresholds.mode) !== null && _a !== void 0 ? _a : ThresholdsMode.Absolute;
    return {
        mode,
        steps: steps.map((t) => {
            const { key } = t, rest = __rest(t, ["key"]);
            return rest; // everything except key
        }),
    };
}
const getStyles = stylesFactory((theme) => {
    return {
        wrapper: css `
      display: flex;
      flex-direction: column;
    `,
        thresholds: css `
      display: flex;
      flex-direction: column;
      margin-bottom: ${theme.spacing(2)};
    `,
        item: css `
      margin-bottom: ${theme.spacing(1)};

      &:last-child {
        margin-bottom: 0;
      }
    `,
        colorPicker: css `
      padding: 0 ${theme.spacing(1)};
    `,
        addButton: css `
      margin-bottom: ${theme.spacing(1)};
    `,
        percentIcon: css `
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
        inputPrefix: css `
      display: flex;
      align-items: center;
    `,
        trashIcon: css `
      color: ${theme.colors.text.secondary};
      cursor: pointer;
      margin-right: 0;

      &:hover {
        color: ${theme.colors.text};
      }
    `,
    };
});
//# sourceMappingURL=ThresholdsEditor.js.map