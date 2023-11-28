import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useMemo, useState } from 'react';
import { useLocalStorage } from 'react-use';
import { Alert, Button, Tooltip, useStyles2 } from '@grafana/ui';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getRulesDataSources, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeDataSourceLink } from '../../utils/misc';
import { isRulerNotSupportedResponse } from '../../utils/rules';
export function RuleListErrors() {
    const [expanded, setExpanded] = useState(false);
    const [closed, setClosed] = useLocalStorage('grafana.unifiedalerting.hideErrors', false);
    const dataSourceConfigRequests = useUnifiedAlertingSelector((state) => state.dataSources);
    const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
    const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
    const styles = useStyles2(getStyles);
    const errors = useMemo(() => {
        var _a, _b;
        const [dataSourceConfigErrors, promRequestErrors, rulerRequestErrors] = [
            dataSourceConfigRequests,
            promRuleRequests,
            rulerRuleRequests,
        ].map((requests) => getRulesDataSources().reduce((result, dataSource) => {
            var _a;
            const error = (_a = requests[dataSource.name]) === null || _a === void 0 ? void 0 : _a.error;
            if (requests[dataSource.name] && error && !isRulerNotSupportedResponse(requests[dataSource.name])) {
                return [...result, { dataSource, error }];
            }
            return result;
        }, []));
        const grafanaPromError = (_a = promRuleRequests[GRAFANA_RULES_SOURCE_NAME]) === null || _a === void 0 ? void 0 : _a.error;
        const grafanaRulerError = (_b = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME]) === null || _b === void 0 ? void 0 : _b.error;
        const result = [];
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
        dataSourceConfigErrors.forEach(({ dataSource, error }) => {
            result.push(React.createElement(React.Fragment, null,
                "Failed to load the data source configuration for",
                ' ',
                React.createElement("a", { href: makeDataSourceLink(dataSource), className: styles.dsLink }, dataSource.name),
                ": ",
                error.message || 'Unknown error.'));
        });
        promRequestErrors.forEach(({ dataSource, error }) => result.push(React.createElement(React.Fragment, null,
            "Failed to load rules state from",
            ' ',
            React.createElement("a", { href: makeDataSourceLink(dataSource), className: styles.dsLink }, dataSource.name),
            ": ",
            error.message || 'Unknown error.')));
        rulerRequestErrors.forEach(({ dataSource, error }) => result.push(React.createElement(React.Fragment, null,
            "Failed to load rules config from",
            ' ',
            React.createElement("a", { href: makeDataSourceLink(dataSource), className: styles.dsLink }, dataSource.name),
            ": ",
            error.message || 'Unknown error.')));
        return result;
    }, [dataSourceConfigRequests, promRuleRequests, rulerRuleRequests, styles.dsLink]);
    return (React.createElement(React.Fragment, null,
        !!errors.length && closed && (React.createElement(ErrorSummaryButton, { count: errors.length, onClick: () => setClosed((closed) => !closed) })),
        !!errors.length && !closed && (React.createElement(Alert, { "data-testid": "cloud-rulessource-errors", title: "Errors loading rules", severity: "error", onRemove: () => setClosed(true) },
            expanded && errors.map((item, idx) => React.createElement("div", { key: idx }, item)),
            !expanded && (React.createElement(React.Fragment, null,
                React.createElement("div", null, errors[0]),
                errors.length >= 2 && (React.createElement(Button, { className: styles.moreButton, fill: "text", icon: "angle-right", size: "sm", onClick: () => setExpanded(true) },
                    errors.length - 1,
                    " more ",
                    pluralize('error', errors.length - 1)))))))));
}
const ErrorSummaryButton = ({ count, onClick }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.floatRight },
        React.createElement(Tooltip, { content: "Show all errors", placement: "bottom" },
            React.createElement(Button, { fill: "text", variant: "destructive", icon: "exclamation-triangle", onClick: onClick }, count > 1 ? React.createElement(React.Fragment, null,
                count,
                " errors") : React.createElement(React.Fragment, null, "1 error")))));
};
const getStyles = (theme) => ({
    moreButton: css `
    padding: 0;
  `,
    floatRight: css `
    display: flex;
    justify-content: flex-end;
  `,
    dsLink: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
//# sourceMappingURL=RuleListErrors.js.map