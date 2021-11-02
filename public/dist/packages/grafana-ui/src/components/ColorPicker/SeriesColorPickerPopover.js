import { __assign, __extends, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { ColorPickerPopover } from './ColorPickerPopover';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { css } from '@emotion/css';
import { withTheme2, useStyles } from '../../themes';
import { Button } from '../Button';
export var SeriesColorPickerPopover = function (props) {
    var styles = useStyles(getStyles);
    var yaxis = props.yaxis, onToggleAxis = props.onToggleAxis, color = props.color, colorPickerProps = __rest(props, ["yaxis", "onToggleAxis", "color"]);
    var customPickers = onToggleAxis
        ? {
            yaxis: {
                name: 'Y-Axis',
                tabComponent: function () {
                    return (React.createElement(Switch, { key: "yaxisSwitch", label: "Use right y-axis", className: styles.colorPickerAxisSwitch, labelClass: styles.colorPickerAxisSwitchLabel, checked: yaxis === 2, onChange: function () {
                            if (onToggleAxis) {
                                onToggleAxis();
                            }
                        } }));
                },
            },
        }
        : undefined;
    return React.createElement(ColorPickerPopover, __assign({}, colorPickerProps, { color: color || '#000000', customPickers: customPickers }));
};
var AxisSelector = /** @class */ (function (_super) {
    __extends(AxisSelector, _super);
    function AxisSelector(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            yaxis: _this.props.yaxis,
        };
        _this.onToggleAxis = _this.onToggleAxis.bind(_this);
        return _this;
    }
    AxisSelector.prototype.onToggleAxis = function () {
        this.setState({
            yaxis: this.state.yaxis === 2 ? 1 : 2,
        });
        if (this.props.onToggleAxis) {
            this.props.onToggleAxis();
        }
    };
    AxisSelector.prototype.render = function () {
        var leftButtonVariant = this.state.yaxis === 1 ? 'primary' : 'secondary';
        var rightButtonVariant = this.state.yaxis === 2 ? 'primary' : 'secondary';
        return (React.createElement("div", { className: "p-b-1" },
            React.createElement("label", { className: "small p-r-1" }, "Y Axis:"),
            React.createElement(Button, { onClick: this.onToggleAxis, size: "sm", variant: leftButtonVariant }, "Left"),
            React.createElement(Button, { onClick: this.onToggleAxis, size: "sm", variant: rightButtonVariant }, "Right")));
    };
    return AxisSelector;
}(React.PureComponent));
export { AxisSelector };
// This component is to enable SeriesColorPickerPopover usage via series-color-picker-popover directive
export var SeriesColorPickerPopoverWithTheme = withTheme2(SeriesColorPickerPopover);
var getStyles = function () {
    return {
        colorPickerAxisSwitch: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 100%;\n    "], ["\n      width: 100%;\n    "]))),
        colorPickerAxisSwitchLabel: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-grow: 1;\n    "], ["\n      display: flex;\n      flex-grow: 1;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=SeriesColorPickerPopover.js.map