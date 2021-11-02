import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Button } from '@grafana/ui';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
var ButtonDisplay = /** @class */ (function (_super) {
    __extends(ButtonDisplay, _super);
    function ButtonDisplay() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ButtonDisplay.prototype.render = function () {
        var data = this.props.data;
        var onClick = function () { return console.log('button being clicked :)'); };
        return React.createElement(Button, { onClick: onClick }, data === null || data === void 0 ? void 0 : data.text);
    };
    return ButtonDisplay;
}(PureComponent));
export var buttonItem = {
    id: 'button',
    name: 'Button',
    description: 'Button',
    display: ButtonDisplay,
    defaultSize: {
        width: 200,
        height: 50,
    },
    getNewOptions: function (options) { return (__assign({}, options)); },
    // Called when data changes
    prepareData: function (ctx, cfg) {
        var data = {
            text: (cfg === null || cfg === void 0 ? void 0 : cfg.text) ? ctx.getText(cfg.text).value() : '',
        };
        return data;
    },
    // Heatmap overlay options
    registerOptionsUI: function (builder) {
        var category = ['Button'];
        builder.addCustomEditor({
            category: category,
            id: 'textSelector',
            path: 'config.text',
            name: 'Text',
            editor: TextDimensionEditor,
        });
    },
};
//# sourceMappingURL=button.js.map