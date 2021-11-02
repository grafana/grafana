import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { formattedValueToString, getFieldDisplayName } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
var DataHoverView = /** @class */ (function (_super) {
    __extends(DataHoverView, _super);
    function DataHoverView() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.style = getStyles(config.theme2);
        return _this;
    }
    DataHoverView.prototype.render = function () {
        var _this = this;
        var _a = this.props, data = _a.data, feature = _a.feature, rowIndex = _a.rowIndex, columnIndex = _a.columnIndex;
        if (feature) {
            return (React.createElement("table", { className: this.style.infoWrap },
                React.createElement("tbody", null, Object.entries(feature.getProperties()).map(function (e, i) {
                    return e[0] === 'geometry' || ( //don't include geojson feature geometry
                    React.createElement("tr", { key: e + "-" + i },
                        React.createElement("th", null, e[0] + ": "),
                        React.createElement("td", null, "" + e[1])));
                }))));
        }
        if (!data || rowIndex == null) {
            return null;
        }
        return (React.createElement("table", { className: this.style.infoWrap },
            React.createElement("tbody", null, data.fields.map(function (f, i) { return (React.createElement("tr", { key: i + "/" + rowIndex, className: i === columnIndex ? _this.style.highlight : '' },
                React.createElement("th", null,
                    getFieldDisplayName(f, data),
                    ":"),
                React.createElement("td", null, fmt(f, rowIndex)))); }))));
    };
    return DataHoverView;
}(PureComponent));
export { DataHoverView };
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
//# sourceMappingURL=DataHoverView.js.map