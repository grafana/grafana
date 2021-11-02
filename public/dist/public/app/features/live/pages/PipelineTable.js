import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Tag, useStyles, IconButton } from '@grafana/ui';
import { css } from '@emotion/css';
import { RuleModal } from './RuleModal';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
function renderOutputTags(key, output) {
    if (!(output === null || output === void 0 ? void 0 : output.type)) {
        return null;
    }
    return React.createElement(Tag, { key: key, name: output.type });
}
export var PipelineTable = function (props) {
    var rules = props.rules;
    var _a = __read(useState(false), 2), isOpen = _a[0], setOpen = _a[1];
    var _b = __read(useState(), 2), selectedRule = _b[0], setSelectedRule = _b[1];
    var _c = __read(useState('converter'), 2), clickColumn = _c[0], setClickColumn = _c[1];
    var styles = useStyles(getStyles);
    var onRowClick = function (rule, event) {
        var _a;
        if (!rule) {
            return;
        }
        var column = (_a = event === null || event === void 0 ? void 0 : event.target) === null || _a === void 0 ? void 0 : _a.getAttribute('data-column');
        if (!column || column === 'pattern') {
            column = 'converter';
        }
        setClickColumn(column);
        setSelectedRule(rule);
        setOpen(true);
    };
    // Supports selecting a rule from external config (after add rule)
    useEffect(function () {
        if (props.selectRule) {
            onRowClick(props.selectRule);
        }
    }, [props.selectRule]);
    var onRemoveRule = function (pattern) {
        getBackendSrv()
            .delete("api/live/channel-rules", JSON.stringify({ pattern: pattern }))
            .catch(function (e) { return console.error(e); })
            .finally(function () {
            props.onRuleChanged();
        });
    };
    var renderPattern = function (pattern) {
        if (pattern.startsWith('ds/')) {
            var idx = pattern.indexOf('/', 4);
            if (idx > 3) {
                var uid = pattern.substring(3, idx);
                var ds = getDatasourceSrv().getInstanceSettings(uid);
                if (ds) {
                    return (React.createElement("div", null,
                        React.createElement(Tag, { name: ds.name, colorIndex: 1 }),
                        " \u00A0",
                        React.createElement("span", null, pattern.substring(idx + 1))));
                }
            }
        }
        return pattern;
    };
    return (React.createElement("div", null,
        React.createElement("div", { className: "admin-list-table" },
            React.createElement("table", { className: "filter-table filter-table--hover form-inline" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Channel"),
                        React.createElement("th", null, "Converter"),
                        React.createElement("th", null, "Processor"),
                        React.createElement("th", null, "Output"),
                        React.createElement("th", { style: { width: 10 } }, "\u00A0"))),
                React.createElement("tbody", null, rules.map(function (rule) {
                    var _a, _b, _c, _d, _e, _f;
                    return (React.createElement("tr", { key: rule.pattern, onClick: function (e) { return onRowClick(rule, e); }, className: styles.row },
                        React.createElement("td", { "data-pattern": rule.pattern, "data-column": "pattern" }, renderPattern(rule.pattern)),
                        React.createElement("td", { "data-pattern": rule.pattern, "data-column": "converter" }, (_b = (_a = rule.settings) === null || _a === void 0 ? void 0 : _a.converter) === null || _b === void 0 ? void 0 : _b.type),
                        React.createElement("td", { "data-pattern": rule.pattern, "data-column": "processor" }, (_d = (_c = rule.settings) === null || _c === void 0 ? void 0 : _c.frameProcessors) === null || _d === void 0 ? void 0 : _d.map(function (processor) { return (React.createElement("span", { key: rule.pattern + processor.type }, processor.type)); })),
                        React.createElement("td", { "data-pattern": rule.pattern, "data-column": "output" }, (_f = (_e = rule.settings) === null || _e === void 0 ? void 0 : _e.frameOutputs) === null || _f === void 0 ? void 0 : _f.map(function (output) { return (React.createElement("span", { key: rule.pattern + output.type }, renderOutputTags('out', output))); })),
                        React.createElement("td", null,
                            React.createElement(IconButton, { name: "trash-alt", onClick: function (e) {
                                    e.stopPropagation();
                                    onRemoveRule(rule.pattern);
                                } }))));
                })))),
        isOpen && selectedRule && (React.createElement(RuleModal, { rule: selectedRule, isOpen: isOpen, onClose: function () {
                setOpen(false);
            }, clickColumn: clickColumn }))));
};
var getStyles = function (theme) {
    return {
        row: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      cursor: pointer;\n    "], ["\n      cursor: pointer;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=PipelineTable.js.map