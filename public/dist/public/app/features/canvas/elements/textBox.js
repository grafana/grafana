import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { css } from '@emotion/css';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
export var Align;
(function (Align) {
    Align["Left"] = "left";
    Align["Center"] = "center";
    Align["Right"] = "right";
})(Align || (Align = {}));
export var VAlign;
(function (VAlign) {
    VAlign["Top"] = "top";
    VAlign["Middle"] = "middle";
    VAlign["Bottom"] = "bottom";
})(VAlign || (VAlign = {}));
var TextBoxDisplay = /** @class */ (function (_super) {
    __extends(TextBoxDisplay, _super);
    function TextBoxDisplay() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TextBoxDisplay.prototype.render = function () {
        var data = this.props.data;
        var styles = getStyles(config.theme2, data);
        return (React.createElement("div", { className: styles.container },
            React.createElement("span", { className: styles.span }, data === null || data === void 0 ? void 0 : data.text)));
    };
    return TextBoxDisplay;
}(PureComponent));
var getStyles = stylesFactory(function (theme, data) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    position: absolute;\n    height: 100%;\n    width: 100%;\n    display: table;\n  "], ["\n    position: absolute;\n    height: 100%;\n    width: 100%;\n    display: table;\n  "]))),
    span: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: table-cell;\n    vertical-align: ", ";\n    text-align: ", ";\n    font-size: ", "px;\n    color: ", ";\n  "], ["\n    display: table-cell;\n    vertical-align: ", ";\n    text-align: ", ";\n    font-size: ", "px;\n    color: ", ";\n  "])), data.valign, data.align, data === null || data === void 0 ? void 0 : data.size, data === null || data === void 0 ? void 0 : data.color),
}); });
export var textBoxItem = {
    id: 'text-box',
    name: 'Text',
    description: 'Text box',
    display: TextBoxDisplay,
    defaultSize: {
        width: 240,
        height: 160,
    },
    getNewOptions: function (options) { return (__assign(__assign({ background: {
            color: {
                fixed: 'grey',
            },
        } }, options), { config: {
            align: Align.Left,
            valign: VAlign.Middle,
        } })); },
    // Called when data changes
    prepareData: function (ctx, cfg) {
        var _a, _b;
        var data = {
            text: cfg.text ? ctx.getText(cfg.text).value() : '',
            align: (_a = cfg.align) !== null && _a !== void 0 ? _a : Align.Center,
            valign: (_b = cfg.valign) !== null && _b !== void 0 ? _b : VAlign.Middle,
            size: cfg.size,
        };
        if (cfg.color) {
            data.color = ctx.getColor(cfg.color).value();
        }
        return data;
    },
    // Heatmap overlay options
    registerOptionsUI: function (builder) {
        var category = ['Text box'];
        builder
            .addCustomEditor({
            category: category,
            id: 'textSelector',
            path: 'config.text',
            name: 'Text',
            editor: TextDimensionEditor,
        })
            .addCustomEditor({
            category: category,
            id: 'config.color',
            path: 'config.color',
            name: 'Text color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {},
        })
            .addRadio({
            category: category,
            path: 'config.align',
            name: 'Align text',
            settings: {
                options: [
                    { value: Align.Left, label: 'Left' },
                    { value: Align.Center, label: 'Center' },
                    { value: Align.Right, label: 'Right' },
                ],
            },
            defaultValue: Align.Left,
        })
            .addRadio({
            category: category,
            path: 'config.valign',
            name: 'Vertical align',
            settings: {
                options: [
                    { value: VAlign.Top, label: 'Top' },
                    { value: VAlign.Middle, label: 'Middle' },
                    { value: VAlign.Bottom, label: 'Bottom' },
                ],
            },
            defaultValue: VAlign.Middle,
        })
            .addNumberInput({
            category: category,
            path: 'config.size',
            name: 'Text size',
            settings: {
                placeholder: 'Auto',
            },
        });
    },
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=textBox.js.map