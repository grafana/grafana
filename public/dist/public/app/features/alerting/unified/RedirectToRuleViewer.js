import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { Redirect } from 'react-router-dom';
import { useLocation } from 'react-use';
import { config, isFetchError } from '@grafana/runtime';
import { Alert, Card, Icon, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import { AlertLabels } from './components/AlertLabels';
import { RuleViewerLayout } from './components/rule-viewer/RuleViewerLayout';
import { useCloudCombinedRulesMatching } from './hooks/useCombinedRule';
import { getRulesSourceByName } from './utils/datasource';
import { createViewLink } from './utils/misc';
import { unescapePathSeparators } from './utils/rule-id';
const pageTitle = 'Find rule';
const subUrl = config.appSubUrl;
function useRuleFindParams() {
    // DO NOT USE REACT-ROUTER HOOKS FOR THIS CODE
    // React-router's useLocation/useParams/props.match are broken and don't preserve original param values when parsing location
    // so, they cannot be used to parse name and sourceName path params
    // React-router messes the pathname up resulting in a string that is neither encoded nor decoded
    // Relevant issue: https://github.com/remix-run/history/issues/505#issuecomment-453175833
    // It was probably fixed in React-Router v6
    const location = useLocation();
    return useMemo(() => {
        var _a, _b, _c, _d;
        const segments = (_b = (_a = location.pathname) === null || _a === void 0 ? void 0 : _a.replace(subUrl, '').split('/')) !== null && _b !== void 0 ? _b : []; // ["", "alerting", "{sourceName}", "{name}]
        const name = unescapePathSeparators(decodeURIComponent(unescapePathSeparators(segments[3])));
        const sourceName = decodeURIComponent(segments[2]);
        const searchParams = new URLSearchParams(location.search);
        return {
            name,
            sourceName,
            namespace: (_c = searchParams.get('namespace')) !== null && _c !== void 0 ? _c : undefined,
            group: (_d = searchParams.get('group')) !== null && _d !== void 0 ? _d : undefined,
        };
    }, [location]);
}
export function RedirectToRuleViewer() {
    const styles = useStyles2(getStyles);
    const { name, sourceName, namespace, group } = useRuleFindParams();
    const { error, loading, rules = [], } = useCloudCombinedRulesMatching(name, sourceName, { namespace, groupName: group });
    if (!name || !sourceName) {
        return React.createElement(Redirect, { to: "/notfound" });
    }
    if (error) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(Alert, { title: `Failed to load rules from ${sourceName}` }, isFetchError(error) && (React.createElement("details", { className: styles.errorMessage },
                error.message,
                React.createElement("br", null))))));
    }
    if (loading) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(LoadingPlaceholder, { text: "Loading rule..." })));
    }
    const rulesSource = getRulesSourceByName(sourceName);
    if (!rulesSource) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(Alert, { title: "Could not view rule" },
                React.createElement("details", { className: styles.errorMessage }, `Could not find data source with name: ${sourceName}.`))));
    }
    if (rules.length === 1) {
        const [rule] = rules;
        const to = createViewLink(rulesSource, rule, '/alerting/list').replace(subUrl, '');
        return React.createElement(Redirect, { to: to });
    }
    if (rules.length === 0) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement("div", { "data-testid": "no-rules" },
                "No rules in ",
                React.createElement("span", { className: styles.param }, sourceName),
                " matched the name",
                ' ',
                React.createElement("span", { className: styles.param }, name))));
    }
    return (React.createElement(RuleViewerLayout, { title: pageTitle },
        React.createElement("div", null,
            "Several rules in ",
            React.createElement("span", { className: styles.param }, sourceName),
            " matched the name",
            ' ',
            React.createElement("span", { className: styles.param }, name),
            ", please select the rule you want to view."),
        React.createElement("div", { className: styles.rules }, rules.map((rule, index) => {
            return (React.createElement(Card, { key: `${rule.name}-${index}`, href: createViewLink(rulesSource, rule, '/alerting/list') },
                React.createElement(Card.Heading, null, rule.name),
                React.createElement(Card.Meta, { separator: '' },
                    React.createElement(Icon, { name: "folder" }),
                    React.createElement("span", { className: styles.namespace }, `${rule.namespace.name} / ${rule.group.name}`)),
                React.createElement(Card.Tags, null,
                    React.createElement(AlertLabels, { labels: rule.labels }))));
        }))));
}
function getStyles(theme) {
    return {
        param: css `
      font-style: italic;
      color: ${theme.colors.text.secondary};
    `,
        rules: css `
      margin-top: ${theme.spacing(2)};
    `,
        namespace: css `
      margin-left: ${theme.spacing(1)};
    `,
        errorMessage: css `
      white-space: pre-wrap;
    `,
    };
}
export default withErrorBoundary(RedirectToRuleViewer, { style: 'page' });
//# sourceMappingURL=RedirectToRuleViewer.js.map