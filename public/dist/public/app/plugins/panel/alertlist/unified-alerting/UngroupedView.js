import { css, cx } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-use';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';
import { Spacer } from 'app/features/alerting/unified/components/Spacer';
import { fromCombinedRule, stringifyIdentifier } from 'app/features/alerting/unified/utils/rule-id';
import { alertStateToReadable, alertStateToState, getFirstActiveAt, isAlertingRule, } from 'app/features/alerting/unified/utils/rules';
import { createUrl } from 'app/features/alerting/unified/utils/url';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../../features/alerting/unified/utils/datasource';
import { AlertInstances } from '../AlertInstances';
import { getStyles } from '../UnifiedAlertList';
function getGrafanaInstancesTotal(totals) {
    return Object.values(totals)
        .filter((total) => total !== undefined)
        .reduce((total, currentTotal) => total + currentTotal, 0);
}
const UngroupedModeView = ({ rules, options, handleInstancesLimit, limitInstances, hideViewRuleLinkText }) => {
    const styles = useStyles2(getStyles);
    const stateStyle = useStyles2(getStateTagStyles);
    const { href: returnTo } = useLocation();
    const rulesToDisplay = rules.length <= options.maxItems ? rules : rules.slice(0, options.maxItems);
    return (React.createElement(React.Fragment, null,
        React.createElement("ol", { className: styles.alertRuleList }, rulesToDisplay.map((ruleWithLocation, index) => {
            var _a;
            const { namespaceName, groupName, dataSourceName } = ruleWithLocation;
            const alertingRule = isAlertingRule(ruleWithLocation.promRule)
                ? ruleWithLocation.promRule
                : undefined;
            const firstActiveAt = getFirstActiveAt(alertingRule);
            const indentifier = fromCombinedRule(ruleWithLocation.dataSourceName, ruleWithLocation);
            const strIndentifier = stringifyIdentifier(indentifier);
            const grafanaInstancesTotal = ruleWithLocation.dataSourceName === GRAFANA_RULES_SOURCE_NAME
                ? getGrafanaInstancesTotal(ruleWithLocation.instanceTotals)
                : undefined;
            const grafanaFilteredInstancesTotal = ruleWithLocation.dataSourceName === GRAFANA_RULES_SOURCE_NAME
                ? getGrafanaInstancesTotal(ruleWithLocation.filteredInstanceTotals)
                : undefined;
            const href = createUrl(`/alerting/${encodeURIComponent(dataSourceName)}/${encodeURIComponent(strIndentifier)}/view`, { returnTo: returnTo !== null && returnTo !== void 0 ? returnTo : '' });
            if (alertingRule) {
                return (React.createElement("li", { className: styles.alertRuleItem, key: `alert-${namespaceName}-${groupName}-${ruleWithLocation.name}-${index}` },
                    React.createElement("div", { className: stateStyle.icon },
                        React.createElement(Icon, { name: alertDef.getStateDisplayModel(alertingRule.state).iconClass, className: stateStyle[alertStateToState(alertingRule.state)], size: 'lg' })),
                    React.createElement("div", { className: styles.alertNameWrapper },
                        React.createElement("div", { className: styles.instanceDetails },
                            React.createElement(Stack, { direction: "row", gap: 1, wrap: false },
                                React.createElement("div", { className: styles.alertName, title: ruleWithLocation.name }, ruleWithLocation.name),
                                React.createElement(Spacer, null),
                                href && (React.createElement("a", { href: href, target: "__blank", className: styles.link, rel: "noopener", "aria-label": "View alert rule" },
                                    React.createElement("span", { className: cx({ [styles.hidden]: hideViewRuleLinkText }) }, "View alert rule"),
                                    React.createElement(Icon, { name: 'external-link-alt', size: "sm" })))),
                            React.createElement("div", { className: styles.alertDuration },
                                React.createElement("span", { className: stateStyle[alertStateToState(alertingRule.state)] }, alertStateToReadable(alertingRule.state)),
                                ' ',
                                firstActiveAt && alertingRule.state !== PromAlertingRuleState.Inactive && (React.createElement(React.Fragment, null,
                                    "for",
                                    ' ',
                                    React.createElement("span", null, intervalToAbbreviatedDurationString({
                                        start: firstActiveAt,
                                        end: Date.now(),
                                    })))))),
                        React.createElement(AlertInstances, { alerts: (_a = alertingRule.alerts) !== null && _a !== void 0 ? _a : [], options: options, grafanaTotalInstances: grafanaInstancesTotal, grafanaFilteredInstancesTotal: grafanaFilteredInstancesTotal, handleInstancesLimit: handleInstancesLimit, limitInstances: limitInstances }))));
            }
            else {
                return null;
            }
        }))));
};
const getStateTagStyles = (theme) => ({
    common: css `
    width: 70px;
    text-align: center;
    align-self: stretch;

    display: inline-block;
    color: white;
    border-radius: ${theme.shape.radius.default};
    font-size: ${theme.typography.bodySmall.fontSize};
    text-transform: capitalize;
    line-height: 1.2;
    flex-shrink: 0;

    display: flex;
    flex-direction: column;
    justify-content: center;
  `,
    icon: css `
    margin-top: ${theme.spacing(2.5)};
    align-self: flex-start;
  `,
    good: css `
    color: ${theme.colors.success.main};
  `,
    bad: css `
    color: ${theme.colors.error.main};
  `,
    warning: css `
    color: ${theme.colors.warning.main};
  `,
    neutral: css `
    color: ${theme.colors.secondary.main};
  `,
    info: css `
    color: ${theme.colors.primary.main};
  `,
});
export default UngroupedModeView;
//# sourceMappingURL=UngroupedView.js.map