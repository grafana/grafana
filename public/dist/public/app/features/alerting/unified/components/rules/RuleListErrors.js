import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import { css } from '@emotion/css';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import pluralize from 'pluralize';
import React, { useMemo, useState } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getRulesDataSources, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isRulerNotSupportedResponse } from '../../utils/rules';
export function RuleListErrors() {
    var _a = __read(useState(false), 2), expanded = _a[0], setExpanded = _a[1];
    var _b = __read(useState(false), 2), closed = _b[0], setClosed = _b[1];
    var promRuleRequests = useUnifiedAlertingSelector(function (state) { return state.promRules; });
    var rulerRuleRequests = useUnifiedAlertingSelector(function (state) { return state.rulerRules; });
    var styles = useStyles2(getStyles);
    var errors = useMemo(function () {
        var _a, _b;
        var _c = __read([promRuleRequests, rulerRuleRequests].map(function (requests) {
            return getRulesDataSources().reduce(function (result, dataSource) {
                var _a;
                var error = (_a = requests[dataSource.name]) === null || _a === void 0 ? void 0 : _a.error;
                if (requests[dataSource.name] && error && !isRulerNotSupportedResponse(requests[dataSource.name])) {
                    return __spreadArray(__spreadArray([], __read(result), false), [{ dataSource: dataSource, error: error }], false);
                }
                return result;
            }, []);
        }), 2), promRequestErrors = _c[0], rulerRequestErrors = _c[1];
        var grafanaPromError = (_a = promRuleRequests[GRAFANA_RULES_SOURCE_NAME]) === null || _a === void 0 ? void 0 : _a.error;
        var grafanaRulerError = (_b = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME]) === null || _b === void 0 ? void 0 : _b.error;
        var result = [];
        if (grafanaPromError) {
            result.push(React.createElement(React.Fragment, null,
                "Failed to load Grafana rules state: ",
                grafanaPromError.message || 'Unknown error.'));
        }
        if (grafanaRulerError) {
            result.push(React.createElement(React.Fragment, null,
                "Failed to load Grafana rules config: ",
                grafanaRulerError.message || 'Unknown error.'));
        }
        promRequestErrors.forEach(function (_a) {
            var dataSource = _a.dataSource, error = _a.error;
            return result.push(React.createElement(React.Fragment, null,
                "Failed to load rules state from ",
                React.createElement("a", { href: "datasources/edit/" + dataSource.uid }, dataSource.name),
                ":",
                ' ',
                error.message || 'Unknown error.'));
        });
        rulerRequestErrors.forEach(function (_a) {
            var dataSource = _a.dataSource, error = _a.error;
            return result.push(React.createElement(React.Fragment, null,
                "Failed to load rules config from ",
                React.createElement("a", { href: 'datasources/edit/${dataSource.uid}' }, dataSource.name),
                ":",
                ' ',
                error.message || 'Unknown error.'));
        });
        return result;
    }, [promRuleRequests, rulerRuleRequests]);
    return (React.createElement(React.Fragment, null, !!errors.length && !closed && (React.createElement(Alert, { "data-testid": "cloud-rulessource-errors", title: "Errors loading rules", severity: "error", onRemove: function () { return setClosed(true); } },
        expanded && errors.map(function (item, idx) { return React.createElement("div", { key: idx }, item); }),
        !expanded && (React.createElement(React.Fragment, null,
            React.createElement("div", null, errors[0]),
            errors.length >= 2 && (React.createElement(Button, { className: styles.moreButton, variant: "link", icon: "angle-right", size: "sm", onClick: function () { return setExpanded(true); } },
                errors.length - 1,
                " more ",
                pluralize('error', errors.length - 1)))))))));
}
var getStyles = function (theme) { return ({
    moreButton: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: 0;\n  "], ["\n    padding: 0;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=RuleListErrors.js.map