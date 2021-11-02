import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { Redirect } from 'react-router-dom';
import { css } from '@emotion/css';
import { Alert, Card, Icon, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useCombinedRulesMatching } from './hooks/useCombinedRule';
import { createViewLink } from './utils/misc';
import { getRulesSourceByName } from './utils/datasource';
import { RuleViewerLayout } from './components/rule-viewer/RuleViewerLayout';
import { AlertLabels } from './components/AlertLabels';
var pageTitle = 'Alerting / Find rule';
export function RedirectToRuleViewer(props) {
    var _a = props.match.params, name = _a.name, sourceName = _a.sourceName;
    var styles = useStyles2(getStyles);
    var _b = useCombinedRulesMatching(name, sourceName), error = _b.error, loading = _b.loading, rules = _b.result, dispatched = _b.dispatched;
    if (error) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(Alert, { title: "Failed to load rules from " + sourceName },
                React.createElement("details", { className: styles.errorMessage },
                    error.message,
                    React.createElement("br", null),
                    !!(error === null || error === void 0 ? void 0 : error.stack) && error.stack))));
    }
    if (loading || !dispatched || !Array.isArray(rules)) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(LoadingPlaceholder, { text: "Loading rule..." })));
    }
    if (!name || !sourceName) {
        return React.createElement(Redirect, { to: "/notfound" });
    }
    var rulesSource = getRulesSourceByName(sourceName);
    if (!rulesSource) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(Alert, { title: "Could not view rule" },
                React.createElement("details", { className: styles.errorMessage }, "Could not find data source with name: " + sourceName + "."))));
    }
    if (rules.length === 1) {
        var _c = __read(rules, 1), rule = _c[0];
        return React.createElement(Redirect, { to: createViewLink(rulesSource, rule, '/alerting/list') });
    }
    return (React.createElement(RuleViewerLayout, { title: pageTitle },
        React.createElement("div", null,
            "Several rules in ",
            React.createElement("span", { className: styles.param }, sourceName),
            " matched the name",
            ' ',
            React.createElement("span", { className: styles.param }, name),
            ", please select the rule you want to view."),
        React.createElement("div", { className: styles.rules }, rules.map(function (rule, index) {
            return (React.createElement(Card, { key: rule.name + "-" + index, heading: rule.name, href: createViewLink(rulesSource, rule, '/alerting/list') },
                React.createElement(Card.Meta, { separator: '' },
                    React.createElement(Icon, { name: "folder" }),
                    React.createElement("span", { className: styles.namespace }, rule.namespace.name + " / " + rule.group.name)),
                React.createElement(Card.Tags, null,
                    React.createElement(AlertLabels, { labels: rule.labels }))));
        }))));
}
function getStyles(theme) {
    return {
        param: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-style: italic;\n      color: ", ";\n    "], ["\n      font-style: italic;\n      color: ", ";\n    "])), theme.colors.text.secondary),
        rules: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing(2)),
        namespace: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(1)),
        errorMessage: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      white-space: pre-wrap;\n    "], ["\n      white-space: pre-wrap;\n    "]))),
    };
}
export default withErrorBoundary(RedirectToRuleViewer, { style: 'page' });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=RedirectToRuleViewer.js.map