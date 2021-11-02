import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { css } from '@emotion/css';
import { LoadingState } from '@grafana/data';
import { withErrorBoundary, useStyles2, Alert, LoadingPlaceholder, PanelChromeLoadingIndicator, Icon, } from '@grafana/ui';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { useCombinedRule } from './hooks/useCombinedRule';
import { alertRuleToQueries } from './utils/query';
import { RuleState } from './components/rules/RuleState';
import { getRulesSourceByName } from './utils/datasource';
import { DetailsField } from './components/DetailsField';
import { RuleHealth } from './components/rules/RuleHealth';
import { RuleViewerVisualization } from './components/rule-viewer/RuleViewerVisualization';
import { RuleDetailsActionButtons } from './components/rules/RuleDetailsActionButtons';
import { RuleDetailsMatchingInstances } from './components/rules/RuleDetailsMatchingInstances';
import { RuleDetailsDataSources } from './components/rules/RuleDetailsDataSources';
import { RuleViewerLayout, RuleViewerLayoutContent } from './components/rule-viewer/RuleViewerLayout';
import { AlertLabels } from './components/AlertLabels';
import { RuleDetailsExpression } from './components/rules/RuleDetailsExpression';
import { RuleDetailsAnnotations } from './components/rules/RuleDetailsAnnotations';
import * as ruleId from './utils/rule-id';
var errorMessage = 'Could not find data source for rule';
var errorTitle = 'Could not view rule';
var pageTitle = 'Alerting / View rule';
export function RuleViewer(_a) {
    var _b;
    var match = _a.match;
    var styles = useStyles2(getStyles);
    var _c = match.params, id = _c.id, sourceName = _c.sourceName;
    var identifier = ruleId.tryParse(id, true);
    var _d = useCombinedRule(identifier, sourceName), loading = _d.loading, error = _d.error, rule = _d.result;
    var runner = useMemo(function () { return new AlertingQueryRunner(); }, []);
    var data = useObservable(runner.get());
    var queries2 = useMemo(function () { return alertRuleToQueries(rule); }, [rule]);
    var _e = __read(useState([]), 2), queries = _e[0], setQueries = _e[1];
    var onRunQueries = useCallback(function () {
        if (queries.length > 0) {
            runner.run(queries);
        }
    }, [queries, runner]);
    useEffect(function () {
        setQueries(queries2);
    }, [queries2]);
    useEffect(function () {
        onRunQueries();
    }, [onRunQueries]);
    useEffect(function () {
        return function () { return runner.destroy(); };
    }, [runner]);
    var onChangeQuery = useCallback(function (query) {
        setQueries(function (queries) {
            return queries.map(function (q) {
                if (q.refId === query.refId) {
                    return query;
                }
                return q;
            });
        });
    }, []);
    if (!sourceName) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(Alert, { title: errorTitle },
                React.createElement("details", { className: styles.errorMessage }, errorMessage))));
    }
    var rulesSource = getRulesSourceByName(sourceName);
    if (loading) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(LoadingPlaceholder, { text: "Loading rule..." })));
    }
    if (error || !rulesSource) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(Alert, { title: errorTitle },
                React.createElement("details", { className: styles.errorMessage }, (_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : errorMessage,
                    React.createElement("br", null),
                    !!(error === null || error === void 0 ? void 0 : error.stack) && error.stack))));
    }
    if (!rule) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement("span", null, "Rule could not be found.")));
    }
    var annotations = Object.entries(rule.annotations).filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], value = _b[1];
        return !!value.trim();
    });
    return (React.createElement(RuleViewerLayout, { wrapInContent: false, title: pageTitle },
        React.createElement(RuleViewerLayoutContent, null,
            React.createElement("div", null,
                React.createElement("h4", null,
                    React.createElement(Icon, { name: "bell", size: "lg" }),
                    " ",
                    rule.name),
                React.createElement(RuleState, { rule: rule, isCreating: false, isDeleting: false }),
                React.createElement(RuleDetailsActionButtons, { rule: rule, rulesSource: rulesSource })),
            React.createElement("div", { className: styles.details },
                React.createElement("div", { className: styles.leftSide },
                    rule.promRule && (React.createElement(DetailsField, { label: "Health", horizontal: true },
                        React.createElement(RuleHealth, { rule: rule.promRule }))),
                    !!rule.labels && !!Object.keys(rule.labels).length && (React.createElement(DetailsField, { label: "Labels", horizontal: true },
                        React.createElement(AlertLabels, { labels: rule.labels }))),
                    React.createElement(RuleDetailsExpression, { rulesSource: rulesSource, rule: rule, annotations: annotations }),
                    React.createElement(RuleDetailsAnnotations, { annotations: annotations })),
                React.createElement("div", { className: styles.rightSide },
                    React.createElement(RuleDetailsDataSources, { rule: rule, rulesSource: rulesSource }),
                    React.createElement(DetailsField, { label: "Namespace / Group" }, rule.namespace.name + " / " + rule.group.name))),
            React.createElement("div", null,
                React.createElement(RuleDetailsMatchingInstances, { promRule: rule.promRule }))),
        data && Object.keys(data).length > 0 && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.queriesTitle },
                "Query results ",
                React.createElement(PanelChromeLoadingIndicator, { loading: isLoading(data), onCancel: function () { return runner.cancel(); } })),
            React.createElement(RuleViewerLayoutContent, { padding: 0 },
                React.createElement("div", { className: styles.queries }, queries.map(function (query) {
                    return (React.createElement("div", { key: query.refId, className: styles.query },
                        React.createElement(RuleViewerVisualization, { query: query, data: data && data[query.refId], onChangeQuery: onChangeQuery })));
                })))))));
}
function isLoading(data) {
    return !!Object.values(data).find(function (d) { return d.state === LoadingState.Loading; });
}
var getStyles = function (theme) {
    return {
        errorMessage: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      white-space: pre-wrap;\n    "], ["\n      white-space: pre-wrap;\n    "]))),
        queries: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      height: 100%;\n      width: 100%;\n    "], ["\n      height: 100%;\n      width: 100%;\n    "]))),
        queriesTitle: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      font-family: ", ";\n    "], ["\n      padding: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      font-family: ", ";\n    "])), theme.spacing(2, 0.5), theme.typography.h5.fontSize, theme.typography.fontWeightBold, theme.typography.h5.fontFamily),
        query: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      border-bottom: 1px solid ", ";\n      padding: ", ";\n    "], ["\n      border-bottom: 1px solid ", ";\n      padding: ", ";\n    "])), theme.colors.border.medium, theme.spacing(2)),
        details: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n    "], ["\n      display: flex;\n      flex-direction: row;\n    "]))),
        leftSide: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      flex: 1;\n    "], ["\n      flex: 1;\n    "]))),
        rightSide: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      padding-left: 90px;\n      width: 300px;\n    "], ["\n      padding-left: 90px;\n      width: 300px;\n    "]))),
    };
};
export default withErrorBoundary(RuleViewer, { style: 'page' });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=RuleViewer.js.map