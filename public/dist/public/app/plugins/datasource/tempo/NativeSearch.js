import { __assign, __awaiter, __generator, __makeTemplateObject, __read } from "tslib";
import React, { useState, useEffect, useMemo } from 'react';
import { InlineFieldRow, InlineField, Input, QueryField, SlatePrism, BracesPlugin, Select, Alert, useStyles2, } from '@grafana/ui';
import { tokenizer } from './syntax';
import Prism from 'prismjs';
import { css } from '@emotion/css';
import { isValidGoDuration } from '@grafana/data';
import TempoLanguageProvider from './language_provider';
import { debounce } from 'lodash';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
var PRISM_LANGUAGE = 'tempo';
var durationPlaceholder = 'e.g. 1.2s, 100ms, 500us';
var plugins = [
    BracesPlugin(),
    SlatePrism({
        onlyIn: function (node) { return node.object === 'block' && node.type === 'code_block'; },
        getSyntax: function () { return PRISM_LANGUAGE; },
    }),
];
Prism.languages[PRISM_LANGUAGE] = tokenizer;
var NativeSearch = function (_a) {
    var datasource = _a.datasource, query = _a.query, onChange = _a.onChange, onBlur = _a.onBlur, onRunQuery = _a.onRunQuery;
    var styles = useStyles2(getStyles);
    var languageProvider = useMemo(function () { return new TempoLanguageProvider(datasource); }, [datasource]);
    var _b = __read(useState(false), 2), hasSyntaxLoaded = _b[0], setHasSyntaxLoaded = _b[1];
    var _c = __read(useState({
        serviceNameOptions: [],
        spanNameOptions: [],
    }), 2), autocomplete = _c[0], setAutocomplete = _c[1];
    var _d = __read(useState(null), 2), error = _d[0], setError = _d[1];
    var _e = __read(useState({}), 2), inputErrors = _e[0], setInputErrors = _e[1];
    var fetchServiceNameOptions = useMemo(function () {
        return debounce(function () { return __awaiter(void 0, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, languageProvider.getOptions('service.name')];
                    case 1:
                        res = _a.sent();
                        setAutocomplete(function (prev) { return (__assign(__assign({}, prev), { serviceNameOptions: res })); });
                        return [2 /*return*/];
                }
            });
        }); }, 500, { leading: true, trailing: true });
    }, [languageProvider]);
    var fetchSpanNameOptions = useMemo(function () {
        return debounce(function () { return __awaiter(void 0, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, languageProvider.getOptions('name')];
                    case 1:
                        res = _a.sent();
                        setAutocomplete(function (prev) { return (__assign(__assign({}, prev), { spanNameOptions: res })); });
                        return [2 /*return*/];
                }
            });
        }); }, 500, { leading: true, trailing: true });
    }, [languageProvider]);
    useEffect(function () {
        var fetchAutocomplete = function () { return __awaiter(void 0, void 0, void 0, function () {
            var serviceNameOptions, spanNameOptions, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, languageProvider.start()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, languageProvider.getOptions('service.name')];
                    case 2:
                        serviceNameOptions = _a.sent();
                        return [4 /*yield*/, languageProvider.getOptions('name')];
                    case 3:
                        spanNameOptions = _a.sent();
                        setHasSyntaxLoaded(true);
                        setAutocomplete({ serviceNameOptions: serviceNameOptions, spanNameOptions: spanNameOptions });
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        // Display message if Tempo is connected but search 404's
                        if ((error_1 === null || error_1 === void 0 ? void 0 : error_1.status) === 404) {
                            setError(error_1);
                        }
                        else {
                            dispatch(notifyApp(createErrorNotification('Error', error_1)));
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        fetchAutocomplete();
    }, [languageProvider, fetchServiceNameOptions, fetchSpanNameOptions]);
    var onTypeahead = function (typeahead) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, languageProvider.provideCompletionItems(typeahead)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var cleanText = function (text) {
        var splittedText = text.split(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g);
        if (splittedText.length > 1) {
            return splittedText[splittedText.length - 1];
        }
        return text;
    };
    var onKeyDown = function (keyEvent) {
        if (keyEvent.key === 'Enter' && (keyEvent.shiftKey || keyEvent.ctrlKey)) {
            onRunQuery();
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.container },
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Service Name", labelWidth: 14, grow: true },
                    React.createElement(Select, { menuShouldPortal: true, options: autocomplete.serviceNameOptions, value: query.serviceName || '', onChange: function (v) {
                            onChange(__assign(__assign({}, query), { serviceName: (v === null || v === void 0 ? void 0 : v.value) || undefined }));
                        }, placeholder: "Select a service", onOpenMenu: fetchServiceNameOptions, isClearable: true, onKeyDown: onKeyDown }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Span Name", labelWidth: 14, grow: true },
                    React.createElement(Select, { menuShouldPortal: true, options: autocomplete.spanNameOptions, value: query.spanName || '', onChange: function (v) {
                            onChange(__assign(__assign({}, query), { spanName: (v === null || v === void 0 ? void 0 : v.value) || undefined }));
                        }, placeholder: "Select a span", onOpenMenu: fetchSpanNameOptions, isClearable: true, onKeyDown: onKeyDown }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Tags", labelWidth: 14, grow: true, tooltip: "Values should be in the logfmt format." },
                    React.createElement(QueryField, { additionalPlugins: plugins, query: query.search, onTypeahead: onTypeahead, onBlur: onBlur, onChange: function (value) {
                            onChange(__assign(__assign({}, query), { search: value }));
                        }, placeholder: "http.status_code=200 error=true", cleanText: cleanText, onRunQuery: onRunQuery, syntaxLoaded: hasSyntaxLoaded, portalOrigin: "tempo" }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Min Duration", invalid: !!inputErrors.minDuration, labelWidth: 14, grow: true },
                    React.createElement(Input, { value: query.minDuration || '', placeholder: durationPlaceholder, onBlur: function () {
                            if (query.minDuration && !isValidGoDuration(query.minDuration)) {
                                setInputErrors(__assign(__assign({}, inputErrors), { minDuration: true }));
                            }
                            else {
                                setInputErrors(__assign(__assign({}, inputErrors), { minDuration: false }));
                            }
                        }, onChange: function (v) {
                            return onChange(__assign(__assign({}, query), { minDuration: v.currentTarget.value }));
                        }, onKeyDown: onKeyDown }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Max Duration", invalid: !!inputErrors.maxDuration, labelWidth: 14, grow: true },
                    React.createElement(Input, { value: query.maxDuration || '', placeholder: durationPlaceholder, onBlur: function () {
                            if (query.maxDuration && !isValidGoDuration(query.maxDuration)) {
                                setInputErrors(__assign(__assign({}, inputErrors), { maxDuration: true }));
                            }
                            else {
                                setInputErrors(__assign(__assign({}, inputErrors), { maxDuration: false }));
                            }
                        }, onChange: function (v) {
                            return onChange(__assign(__assign({}, query), { maxDuration: v.currentTarget.value }));
                        }, onKeyDown: onKeyDown }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Limit", invalid: !!inputErrors.limit, labelWidth: 14, grow: true, tooltip: "Maximum numbers of returned results" },
                    React.createElement(Input, { value: query.limit || '', type: "number", onChange: function (v) {
                            var limit = v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined;
                            if (limit && (!Number.isInteger(limit) || limit <= 0)) {
                                setInputErrors(__assign(__assign({}, inputErrors), { limit: true }));
                            }
                            else {
                                setInputErrors(__assign(__assign({}, inputErrors), { limit: false }));
                            }
                            onChange(__assign(__assign({}, query), { limit: v.currentTarget.value ? parseInt(v.currentTarget.value, 10) : undefined }));
                        }, onKeyDown: onKeyDown })))),
        error ? (React.createElement(Alert, { title: "Unable to connect to Tempo search", severity: "info", className: styles.alert },
            "Please ensure that Tempo is configured with search enabled. If you would like to hide this tab, you can configure it in the ",
            React.createElement("a", { href: "/datasources/edit/" + datasource.uid }, "datasource settings"),
            ".")) : null));
};
export default NativeSearch;
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    max-width: 500px;\n  "], ["\n    max-width: 500px;\n  "]))),
    alert: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    max-width: 75ch;\n    margin-top: ", ";\n  "], ["\n    max-width: 75ch;\n    margin-top: ", ";\n  "])), theme.spacing(2)),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=NativeSearch.js.map