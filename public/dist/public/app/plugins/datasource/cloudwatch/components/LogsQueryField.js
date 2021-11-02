import { __assign, __awaiter, __extends, __generator, __makeTemplateObject, __read, __spreadArray } from "tslib";
// Libraries
import React from 'react';
import { intersectionBy, debounce, unionBy } from 'lodash';
import { BracesPlugin, LegacyForms, MultiSelect, QueryField, Select, SlatePrism, } from '@grafana/ui';
import syntax from '../syntax';
import { languages as prismLanguages } from 'prismjs';
import { css } from '@emotion/css';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getStatsGroups } from '../utils/query/getStatsGroups';
var containerClass = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  flex-grow: 1;\n  min-height: 35px;\n"], ["\n  flex-grow: 1;\n  min-height: 35px;\n"])));
var rowGap = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  gap: 3px;\n"], ["\n  gap: 3px;\n"])));
var CloudWatchLogsQueryField = /** @class */ (function (_super) {
    __extends(CloudWatchLogsQueryField, _super);
    function CloudWatchLogsQueryField(props, context) {
        var _a, _b;
        var _this = _super.call(this, props, context) || this;
        _this.state = {
            selectedLogGroups: (_b = (_a = _this.props.query.logGroupNames) === null || _a === void 0 ? void 0 : _a.map(function (logGroup) { return ({
                value: logGroup,
                label: logGroup,
            }); })) !== null && _b !== void 0 ? _b : [],
            availableLogGroups: [],
            regions: [],
            invalidLogGroups: false,
            selectedRegion: _this.props.query.region
                ? {
                    label: _this.props.query.region,
                    value: _this.props.query.region,
                    text: _this.props.query.region,
                }
                : { label: 'default', value: 'default', text: 'default' },
            loadingLogGroups: false,
            hint: undefined,
        };
        _this.fetchLogGroupOptions = function (region, logGroupNamePrefix) { return __awaiter(_this, void 0, void 0, function () {
            var logGroups, err_1, errMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.props.datasource.describeLogGroups({
                                refId: this.props.query.refId,
                                region: region,
                                logGroupNamePrefix: logGroupNamePrefix,
                            })];
                    case 1:
                        logGroups = _a.sent();
                        return [2 /*return*/, logGroups.map(function (logGroup) { return ({
                                value: logGroup,
                                label: logGroup,
                            }); })];
                    case 2:
                        err_1 = _a.sent();
                        errMessage = 'unknown error';
                        if (typeof err_1 !== 'string') {
                            try {
                                errMessage = JSON.stringify(err_1);
                            }
                            catch (e) { }
                        }
                        else {
                            errMessage = err_1;
                        }
                        dispatch(notifyApp(createErrorNotification(errMessage)));
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        _this.onLogGroupSearch = function (searchTerm, region, actionMeta) {
            if (actionMeta.action !== 'input-change') {
                return Promise.resolve();
            }
            // No need to fetch matching log groups if the search term isn't valid
            // This is also useful for preventing searches when a user is typing out a log group with template vars
            // See https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html for the source of the pattern below
            var logGroupNamePattern = /^[\.\-_/#A-Za-z0-9]+$/;
            if (!logGroupNamePattern.test(searchTerm)) {
                return Promise.resolve();
            }
            _this.setState({
                loadingLogGroups: true,
            });
            return _this.fetchLogGroupOptions(region, searchTerm)
                .then(function (matchingLogGroups) {
                _this.setState(function (state) { return ({
                    availableLogGroups: unionBy(state.availableLogGroups, matchingLogGroups, 'value'),
                }); });
            })
                .finally(function () {
                _this.setState({
                    loadingLogGroups: false,
                });
            });
        };
        _this.onLogGroupSearchDebounced = debounce(_this.onLogGroupSearch, 300);
        _this.componentDidMount = function () {
            var _a = _this.props, datasource = _a.datasource, query = _a.query, onChange = _a.onChange;
            _this.setState({
                loadingLogGroups: true,
            });
            _this.fetchLogGroupOptions(query.region).then(function (logGroups) {
                _this.setState(function (state) {
                    var selectedLogGroups = state.selectedLogGroups;
                    if (onChange) {
                        var nextQuery = __assign(__assign({}, query), { logGroupNames: selectedLogGroups.map(function (group) { return group.value; }) });
                        onChange(nextQuery);
                    }
                    return {
                        loadingLogGroups: false,
                        availableLogGroups: logGroups,
                        selectedLogGroups: selectedLogGroups,
                    };
                });
            });
            datasource.getRegions().then(function (regions) {
                _this.setState({
                    regions: regions,
                });
            });
        };
        _this.onChangeQuery = function (value) {
            var _a, _b;
            // Send text change to parent
            var _c = _this.props, query = _c.query, onChange = _c.onChange;
            var _d = _this.state, selectedLogGroups = _d.selectedLogGroups, selectedRegion = _d.selectedRegion;
            if (onChange) {
                var nextQuery = __assign(__assign({}, query), { expression: value, logGroupNames: (_a = selectedLogGroups === null || selectedLogGroups === void 0 ? void 0 : selectedLogGroups.map(function (logGroupName) { return logGroupName.value; })) !== null && _a !== void 0 ? _a : [], region: (_b = selectedRegion.value) !== null && _b !== void 0 ? _b : 'default', statsGroups: getStatsGroups(value) });
                onChange(nextQuery);
            }
        };
        _this.setSelectedLogGroups = function (selectedLogGroups) {
            var _a;
            _this.setState({
                selectedLogGroups: selectedLogGroups,
            });
            var _b = _this.props, onChange = _b.onChange, query = _b.query;
            onChange === null || onChange === void 0 ? void 0 : onChange(__assign(__assign({}, query), { logGroupNames: (_a = selectedLogGroups.map(function (logGroupName) { return logGroupName.value; })) !== null && _a !== void 0 ? _a : [] }));
        };
        _this.setCustomLogGroups = function (v) {
            var customLogGroup = { value: v, label: v };
            var selectedLogGroups = __spreadArray(__spreadArray([], __read(_this.state.selectedLogGroups), false), [customLogGroup], false);
            _this.setSelectedLogGroups(selectedLogGroups);
        };
        _this.setSelectedRegion = function (v) { return __awaiter(_this, void 0, void 0, function () {
            var logGroups;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.setState({
                            selectedRegion: v,
                            loadingLogGroups: true,
                        });
                        return [4 /*yield*/, this.fetchLogGroupOptions(v.value)];
                    case 1:
                        logGroups = _a.sent();
                        this.setState(function (state) {
                            var _a;
                            var selectedLogGroups = intersectionBy(state.selectedLogGroups, logGroups, 'value');
                            var _b = _this.props, onChange = _b.onChange, query = _b.query;
                            if (onChange) {
                                var nextQuery = __assign(__assign({}, query), { region: (_a = v.value) !== null && _a !== void 0 ? _a : 'default', logGroupNames: selectedLogGroups.map(function (group) { return group.value; }) });
                                onChange(nextQuery);
                            }
                            return {
                                availableLogGroups: logGroups,
                                selectedLogGroups: selectedLogGroups,
                                loadingLogGroups: false,
                            };
                        });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onTypeahead = function (typeahead) { return __awaiter(_this, void 0, void 0, function () {
            var datasource, selectedLogGroups, cloudwatchLanguageProvider, _a, history, absoluteRange, prefix, text, value, wrapperClasses, labelKey, editor;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        datasource = this.props.datasource;
                        selectedLogGroups = this.state.selectedLogGroups;
                        if (!datasource.languageProvider) {
                            return [2 /*return*/, { suggestions: [] }];
                        }
                        cloudwatchLanguageProvider = datasource.languageProvider;
                        _a = this.props, history = _a.history, absoluteRange = _a.absoluteRange;
                        prefix = typeahead.prefix, text = typeahead.text, value = typeahead.value, wrapperClasses = typeahead.wrapperClasses, labelKey = typeahead.labelKey, editor = typeahead.editor;
                        return [4 /*yield*/, cloudwatchLanguageProvider.provideCompletionItems({ text: text, value: value, prefix: prefix, wrapperClasses: wrapperClasses, labelKey: labelKey, editor: editor }, { history: history, absoluteRange: absoluteRange, logGroupNames: selectedLogGroups.map(function (logGroup) { return logGroup.value; }) })];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        }); };
        _this.onQueryFieldClick = function (_event, _editor, next) {
            var _a = _this.state, selectedLogGroups = _a.selectedLogGroups, loadingLogGroups = _a.loadingLogGroups;
            var queryFieldDisabled = loadingLogGroups || selectedLogGroups.length === 0;
            if (queryFieldDisabled) {
                _this.setState({
                    invalidLogGroups: true,
                });
            }
            next();
        };
        _this.onOpenLogGroupMenu = function () {
            _this.setState({
                invalidLogGroups: false,
            });
        };
        _this.plugins = [
            BracesPlugin(),
            SlatePrism({
                onlyIn: function (node) { return node.object === 'block' && node.type === 'code_block'; },
                getSyntax: function (node) { return 'cloudwatch'; },
            }, __assign(__assign({}, prismLanguages), { cloudwatch: syntax })),
        ];
        return _this;
    }
    CloudWatchLogsQueryField.prototype.render = function () {
        var _this = this;
        var _a, _b;
        var _c = this.props, ExtraFieldElement = _c.ExtraFieldElement, data = _c.data, query = _c.query, datasource = _c.datasource, allowCustomValue = _c.allowCustomValue;
        var _d = this.state, selectedLogGroups = _d.selectedLogGroups, availableLogGroups = _d.availableLogGroups, regions = _d.regions, selectedRegion = _d.selectedRegion, loadingLogGroups = _d.loadingLogGroups, hint = _d.hint, invalidLogGroups = _d.invalidLogGroups;
        var showError = data && data.error && data.error.refId === query.refId;
        var cleanText = datasource.languageProvider ? datasource.languageProvider.cleanText : undefined;
        var MAX_LOG_GROUPS = 20;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form gf-form--grow flex-grow-1 " + rowGap },
                React.createElement(LegacyForms.FormField, { label: "Region", labelWidth: 4, inputEl: React.createElement(Select, { menuShouldPortal: true, options: regions, value: selectedRegion, onChange: function (v) { return _this.setSelectedRegion(v); }, width: 18, placeholder: "Choose Region", maxMenuHeight: 500 }) }),
                React.createElement(LegacyForms.FormField, { label: "Log Groups", labelWidth: 6, className: "flex-grow-1", inputEl: React.createElement(MultiSelect, { menuShouldPortal: true, allowCustomValue: allowCustomValue, options: unionBy(availableLogGroups, selectedLogGroups, 'value'), value: selectedLogGroups, onChange: function (v) {
                            _this.setSelectedLogGroups(v);
                        }, onCreateOption: function (v) {
                            _this.setCustomLogGroups(v);
                        }, className: containerClass, closeMenuOnSelect: false, isClearable: true, invalid: invalidLogGroups, isOptionDisabled: function () { return selectedLogGroups.length >= MAX_LOG_GROUPS; }, placeholder: "Choose Log Groups", maxVisibleValues: 4, noOptionsMessage: "No log groups available", isLoading: loadingLogGroups, onOpenMenu: this.onOpenLogGroupMenu, onInputChange: function (value, actionMeta) {
                            var _a;
                            _this.onLogGroupSearchDebounced(value, (_a = selectedRegion.value) !== null && _a !== void 0 ? _a : 'default', actionMeta);
                        } }) })),
            React.createElement("div", { className: "gf-form-inline gf-form-inline--nowrap flex-grow-1" },
                React.createElement("div", { className: "gf-form gf-form--grow flex-shrink-1" },
                    React.createElement(QueryField, { additionalPlugins: this.plugins, query: (_a = query.expression) !== null && _a !== void 0 ? _a : '', onChange: this.onChangeQuery, onBlur: this.props.onBlur, onClick: this.onQueryFieldClick, onRunQuery: this.props.onRunQuery, onTypeahead: this.onTypeahead, cleanText: cleanText, placeholder: "Enter a CloudWatch Logs Insights query (run with Shift+Enter)", portalOrigin: "cloudwatch", disabled: loadingLogGroups || selectedLogGroups.length === 0 })),
                ExtraFieldElement),
            hint && (React.createElement("div", { className: "query-row-break" },
                React.createElement("div", { className: "text-warning" },
                    hint.message,
                    React.createElement("a", { className: "text-link muted", onClick: hint.fix.action }, hint.fix.label)))),
            showError ? (React.createElement("div", { className: "query-row-break" },
                React.createElement("div", { className: "prom-query-field-info text-error" }, (_b = data === null || data === void 0 ? void 0 : data.error) === null || _b === void 0 ? void 0 : _b.message))) : null));
    };
    return CloudWatchLogsQueryField;
}(React.PureComponent));
export { CloudWatchLogsQueryField };
var templateObject_1, templateObject_2;
//# sourceMappingURL=LogsQueryField.js.map