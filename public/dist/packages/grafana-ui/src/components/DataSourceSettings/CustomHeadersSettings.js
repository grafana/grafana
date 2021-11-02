import { __assign, __extends, __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import { Button } from '../Button';
import { FormField } from '../FormField/FormField';
import { Icon } from '../Icon/Icon';
import { SecretFormField } from '../SecretFormField/SecretFormField';
import { stylesFactory } from '../../themes';
var getCustomHeaderRowStyles = stylesFactory(function () {
    return {
        layout: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      margin-bottom: 4px;\n      > * {\n        margin-left: 4px;\n        margin-bottom: 0;\n        height: 100%;\n        &:first-child,\n        &:last-child {\n          margin-left: 0;\n        }\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      margin-bottom: 4px;\n      > * {\n        margin-left: 4px;\n        margin-bottom: 0;\n        height: 100%;\n        &:first-child,\n        &:last-child {\n          margin-left: 0;\n        }\n      }\n    "]))),
    };
});
var CustomHeaderRow = function (_a) {
    var header = _a.header, onBlur = _a.onBlur, onChange = _a.onChange, onRemove = _a.onRemove, onReset = _a.onReset;
    var styles = getCustomHeaderRowStyles();
    return (React.createElement("div", { className: styles.layout },
        React.createElement(FormField, { label: "Header", name: "name", placeholder: "X-Custom-Header", labelWidth: 5, value: header.name || '', onChange: function (e) { return onChange(__assign(__assign({}, header), { name: e.target.value })); }, onBlur: onBlur }),
        React.createElement(SecretFormField, { label: "Value", name: "value", isConfigured: header.configured, value: header.value, labelWidth: 5, inputWidth: header.configured ? 11 : 12, placeholder: "Header Value", onReset: function () { return onReset(header.id); }, onChange: function (e) { return onChange(__assign(__assign({}, header), { value: e.target.value })); }, onBlur: onBlur }),
        React.createElement(Button, { type: "button", "aria-label": "Remove header", variant: "secondary", size: "xs", onClick: function (_e) { return onRemove(header.id); } },
            React.createElement(Icon, { name: "trash-alt" }))));
};
CustomHeaderRow.displayName = 'CustomHeaderRow';
var CustomHeadersSettings = /** @class */ (function (_super) {
    __extends(CustomHeadersSettings, _super);
    function CustomHeadersSettings(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            headers: [],
        };
        _this.updateSettings = function () {
            var e_1, _a;
            var headers = _this.state.headers;
            // we remove every httpHeaderName* field
            var newJsonData = Object.fromEntries(Object.entries(_this.props.dataSourceConfig.jsonData).filter(function (_a) {
                var _b = __read(_a, 2), key = _b[0], val = _b[1];
                return !key.startsWith('httpHeaderName');
            }));
            // we remove every httpHeaderValue* field
            var newSecureJsonData = Object.fromEntries(Object.entries(_this.props.dataSourceConfig.secureJsonData || {}).filter(function (_a) {
                var _b = __read(_a, 2), key = _b[0], val = _b[1];
                return !key.startsWith('httpHeaderValue');
            }));
            try {
                // then we add the current httpHeader-fields
                for (var _b = __values(headers.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = __read(_c.value, 2), index = _d[0], header = _d[1];
                    newJsonData["httpHeaderName" + (index + 1)] = header.name;
                    if (!header.configured) {
                        newSecureJsonData["httpHeaderValue" + (index + 1)] = header.value;
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
            _this.props.onChange(__assign(__assign({}, _this.props.dataSourceConfig), { jsonData: newJsonData, secureJsonData: newSecureJsonData }));
        };
        _this.onHeaderAdd = function () {
            _this.setState(function (prevState) {
                return { headers: __spreadArray(__spreadArray([], __read(prevState.headers), false), [{ id: uniqueId(), name: '', value: '', configured: false }], false) };
            });
        };
        _this.onHeaderChange = function (headerIndex, value) {
            _this.setState(function (_a) {
                var headers = _a.headers;
                return {
                    headers: headers.map(function (item, index) {
                        if (headerIndex !== index) {
                            return item;
                        }
                        return __assign({}, value);
                    }),
                };
            });
        };
        _this.onHeaderReset = function (headerId) {
            _this.setState(function (_a) {
                var headers = _a.headers;
                return {
                    headers: headers.map(function (h, i) {
                        if (h.id !== headerId) {
                            return h;
                        }
                        return __assign(__assign({}, h), { value: '', configured: false });
                    }),
                };
            });
        };
        _this.onHeaderRemove = function (headerId) {
            _this.setState(function (_a) {
                var headers = _a.headers;
                return ({
                    headers: headers.filter(function (h) { return h.id !== headerId; }),
                });
            }, _this.updateSettings);
        };
        var _a = _this.props.dataSourceConfig, jsonData = _a.jsonData, secureJsonData = _a.secureJsonData, secureJsonFields = _a.secureJsonFields;
        _this.state = {
            headers: Object.keys(jsonData)
                .sort()
                .filter(function (key) { return key.startsWith('httpHeaderName'); })
                .map(function (key, index) {
                return {
                    id: uniqueId(),
                    name: jsonData[key],
                    value: secureJsonData !== undefined ? secureJsonData[key] : '',
                    configured: (secureJsonFields && secureJsonFields["httpHeaderValue" + (index + 1)]) || false,
                };
            }),
        };
        return _this;
    }
    CustomHeadersSettings.prototype.render = function () {
        var _this = this;
        var headers = this.state.headers;
        return (React.createElement("div", { className: 'gf-form-group' },
            React.createElement("div", { className: "gf-form" },
                React.createElement("h6", null, "Custom HTTP Headers")),
            React.createElement("div", null, headers.map(function (header, i) { return (React.createElement(CustomHeaderRow, { key: header.id, header: header, onChange: function (h) {
                    _this.onHeaderChange(i, h);
                }, onBlur: _this.updateSettings, onRemove: _this.onHeaderRemove, onReset: _this.onHeaderReset })); })),
            React.createElement("div", { className: "gf-form" },
                React.createElement(Button, { variant: "secondary", icon: "plus", type: "button", onClick: function (e) {
                        _this.onHeaderAdd();
                    } }, "Add header"))));
    };
    return CustomHeadersSettings;
}(PureComponent));
export { CustomHeadersSettings };
export default CustomHeadersSettings;
var templateObject_1;
//# sourceMappingURL=CustomHeadersSettings.js.map