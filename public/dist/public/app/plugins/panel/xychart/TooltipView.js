import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { formattedValueToString, getFieldDisplayName } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
var TooltipView = /** @class */ (function (_super) {
    __extends(TooltipView, _super);
    function TooltipView() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.style = getStyles(config.theme2);
        return _this;
    }
    TooltipView.prototype.render = function () {
        var _this = this;
        var _a = this.props, series = _a.series, data = _a.data, rowIndex = _a.rowIndex;
        if (!series || rowIndex == null) {
            return null;
        }
        var frame = series.frame(data);
        var y = undefined; // series.y(frame);
        return (React.createElement("table", { className: this.style.infoWrap },
            React.createElement("tbody", null, frame.fields.map(function (f, i) { return (React.createElement("tr", { key: i + "/" + rowIndex, className: f === y ? _this.style.highlight : '' },
                React.createElement("th", null,
                    getFieldDisplayName(f, frame),
                    ":"),
                React.createElement("td", null, fmt(f, rowIndex)))); }))));
    };
    return TooltipView;
}(PureComponent));
export { TooltipView };
function fmt(field, row) {
    var v = field.values.get(row);
    if (field.display) {
        return formattedValueToString(field.display(v));
    }
    return "" + v;
}
var getStyles = stylesFactory(function (theme) { return ({
    infoWrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: 8px;\n    th {\n      font-weight: ", ";\n      padding: ", ";\n    }\n  "], ["\n    padding: 8px;\n    th {\n      font-weight: ", ";\n      padding: ", ";\n    }\n  "])), theme.typography.fontWeightMedium, theme.spacing(0.25, 2)),
    highlight: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    background: ", ";\n  "], ["\n    background: ", ";\n  "])), theme.colors.action.hover),
}); });
var templateObject_1, templateObject_2;
//# sourceMappingURL=TooltipView.js.map