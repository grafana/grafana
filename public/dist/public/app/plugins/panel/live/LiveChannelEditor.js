import { __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { Select, Alert, Label, stylesFactory } from '@grafana/ui';
import { LiveChannelScope, } from '@grafana/data';
import { getGrafanaLiveScopes } from 'app/features/live';
import { config } from 'app/core/config';
var scopes = [
    { label: 'Grafana', value: LiveChannelScope.Grafana, description: 'Core grafana live features' },
    { label: 'Data Sources', value: LiveChannelScope.DataSource, description: 'Data sources with live support' },
    { label: 'Plugins', value: LiveChannelScope.Plugin, description: 'Plugins with live support' },
];
var LiveChannelEditor = /** @class */ (function (_super) {
    __extends(LiveChannelEditor, _super);
    function LiveChannelEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            namespaces: [],
            paths: [],
        };
        _this.onScopeChanged = function (v) {
            if (v.value) {
                _this.props.onChange({
                    scope: v.value,
                    namespace: undefined,
                    path: undefined,
                });
            }
        };
        _this.onNamespaceChanged = function (v) {
            var _a;
            var update = {
                scope: (_a = _this.props.value) === null || _a === void 0 ? void 0 : _a.scope,
                path: undefined,
            };
            if (v.value) {
                update.namespace = v.value;
            }
            _this.props.onChange(update);
        };
        _this.onPathChanged = function (v) {
            var _a = _this.props, value = _a.value, onChange = _a.onChange;
            var update = {
                scope: value.scope,
                namespace: value.namespace,
            };
            if (v.value) {
                update.path = v.value;
            }
            onChange(update);
        };
        return _this;
    }
    LiveChannelEditor.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.updateSelectOptions();
                return [2 /*return*/];
            });
        });
    };
    LiveChannelEditor.prototype.componentDidUpdate = function (oldProps) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.props.value !== oldProps.value) {
                    this.updateSelectOptions();
                }
                return [2 /*return*/];
            });
        });
    };
    LiveChannelEditor.prototype.getScopeDetails = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, scope, namespace, srv, namespaces, support, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = this.props.value, scope = _a.scope, namespace = _a.namespace;
                        srv = getGrafanaLiveScopes();
                        if (!srv.doesScopeExist(scope)) {
                            return [2 /*return*/, {
                                    namespaces: [],
                                    support: undefined,
                                }];
                        }
                        return [4 /*yield*/, srv.getNamespaces(scope)];
                    case 1:
                        namespaces = _c.sent();
                        if (!namespace) return [3 /*break*/, 3];
                        return [4 /*yield*/, srv.getChannelSupport(scope, namespace)];
                    case 2:
                        _b = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _b = undefined;
                        _c.label = 4;
                    case 4:
                        support = _b;
                        return [2 /*return*/, {
                                namespaces: namespaces,
                                support: support,
                            }];
                }
            });
        });
    };
    LiveChannelEditor.prototype.updateSelectOptions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, namespaces, support;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getScopeDetails()];
                    case 1:
                        _a = _b.sent(), namespaces = _a.namespaces, support = _a.support;
                        this.setState({
                            namespaces: namespaces,
                            support: support,
                            paths: [],
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    LiveChannelEditor.prototype.render = function () {
        var _a;
        var _b = this.state, namespaces = _b.namespaces, paths = _b.paths;
        var _c = this.props.value, scope = _c.scope, namespace = _c.namespace, path = _c.path;
        var style = getStyles(config.theme);
        return (React.createElement(React.Fragment, null,
            React.createElement(Alert, { title: "Grafana Live", severity: "info" }, "This supports real-time event streams in grafana core. This feature is under heavy development. Expect the intefaces and structures to change as this becomes more production ready."),
            React.createElement("div", null,
                React.createElement("div", { className: style.dropWrap },
                    React.createElement(Label, null, "Scope"),
                    React.createElement(Select, { menuShouldPortal: true, options: scopes, value: scopes.find(function (s) { return s.value === scope; }), onChange: this.onScopeChanged })),
                scope && (React.createElement("div", { className: style.dropWrap },
                    React.createElement(Label, null, "Namespace"),
                    React.createElement(Select, { menuShouldPortal: true, options: namespaces, value: (_a = namespaces.find(function (s) { return s.value === namespace; })) !== null && _a !== void 0 ? _a : (namespace ? { label: namespace, value: namespace } : undefined), onChange: this.onNamespaceChanged, allowCustomValue: true, backspaceRemovesValue: true }))),
                scope && namespace && (React.createElement("div", { className: style.dropWrap },
                    React.createElement(Label, null, "Path"),
                    React.createElement(Select, { menuShouldPortal: true, options: paths, value: findPathOption(paths, path), onChange: this.onPathChanged, allowCustomValue: true, backspaceRemovesValue: true }))))));
    };
    return LiveChannelEditor;
}(PureComponent));
export { LiveChannelEditor };
function findPathOption(paths, path) {
    var v = paths.find(function (s) { return s.value === path; });
    if (v) {
        return v;
    }
    if (path) {
        return { label: path, value: path };
    }
    return undefined;
}
var getStyles = stylesFactory(function (theme) { return ({
    dropWrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing.sm),
}); });
var templateObject_1;
//# sourceMappingURL=LiveChannelEditor.js.map