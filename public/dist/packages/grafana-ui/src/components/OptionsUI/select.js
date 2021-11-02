import { __awaiter, __extends, __generator } from "tslib";
import React from 'react';
import { Select } from '../Select/Select';
var SelectValueEditor = /** @class */ (function (_super) {
    __extends(SelectValueEditor, _super);
    function SelectValueEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isLoading: true,
            options: [],
        };
        _this.updateOptions = function () { return __awaiter(_this, void 0, void 0, function () {
            var item, settings, options;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        item = this.props.item;
                        settings = item.settings;
                        options = ((_a = item.settings) === null || _a === void 0 ? void 0 : _a.options) || [];
                        if (!(settings === null || settings === void 0 ? void 0 : settings.getOptions)) return [3 /*break*/, 2];
                        return [4 /*yield*/, settings.getOptions(this.props.context)];
                    case 1:
                        options = _b.sent();
                        _b.label = 2;
                    case 2:
                        if (this.state.options !== options) {
                            this.setState({
                                isLoading: false,
                                options: options,
                            });
                        }
                        return [2 /*return*/];
                }
            });
        }); };
        return _this;
    }
    SelectValueEditor.prototype.componentDidMount = function () {
        this.updateOptions();
    };
    SelectValueEditor.prototype.componentDidUpdate = function (oldProps) {
        var _a, _b, _c, _d;
        var old = (_a = oldProps.item) === null || _a === void 0 ? void 0 : _a.settings;
        var now = (_b = this.props.item) === null || _b === void 0 ? void 0 : _b.settings;
        if (old !== now) {
            this.updateOptions();
        }
        else if (now === null || now === void 0 ? void 0 : now.getOptions) {
            var old_1 = (_c = oldProps.context) === null || _c === void 0 ? void 0 : _c.data;
            var now_1 = (_d = this.props.context) === null || _d === void 0 ? void 0 : _d.data;
            if (old_1 !== now_1) {
                this.updateOptions();
            }
        }
    };
    SelectValueEditor.prototype.render = function () {
        var _a = this.state, options = _a.options, isLoading = _a.isLoading;
        var _b = this.props, value = _b.value, onChange = _b.onChange, item = _b.item;
        var settings = item.settings;
        var current = options.find(function (v) { return v.value === value; });
        if (!current && value) {
            current = {
                label: "" + value,
                value: value,
            };
        }
        return (React.createElement(Select, { menuShouldPortal: true, isLoading: isLoading, value: current, defaultValue: value, allowCustomValue: settings === null || settings === void 0 ? void 0 : settings.allowCustomValue, onChange: function (e) { return onChange(e.value); }, options: options }));
    };
    return SelectValueEditor;
}(React.PureComponent));
export { SelectValueEditor };
//# sourceMappingURL=select.js.map