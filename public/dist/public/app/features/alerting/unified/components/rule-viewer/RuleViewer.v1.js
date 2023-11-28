import { css } from '@emotion/css';
import { produce } from 'immer';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useObservable, useToggle } from 'react-use';
import { LoadingState } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { config, isFetchError } from '@grafana/runtime';
import { Alert, Button, Collapse, Icon, IconButton, LoadingPlaceholder, useStyles2, VerticalGroup } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { GrafanaRuleQueryViewer, QueryPreview } from '../../GrafanaRuleQueryViewer';
import { useAlertQueriesStatus } from '../../hooks/useAlertQueriesStatus';
import { useCombinedRule } from '../../hooks/useCombinedRule';
import { AlertingQueryRunner } from '../../state/AlertingQueryRunner';
import { useCleanAnnotations } from '../../utils/annotations';
import { getRulesSourceByName } from '../../utils/datasource';
import { alertRuleToQueries } from '../../utils/query';
import * as ruleId from '../../utils/rule-id';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { DetailsField } from '../DetailsField';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { RuleViewerLayout, RuleViewerLayoutContent } from '../rule-viewer/RuleViewerLayout';
import { RuleDetailsActionButtons } from '../rules/RuleDetailsActionButtons';
import { RuleDetailsAnnotations } from '../rules/RuleDetailsAnnotations';
import { RuleDetailsDataSources } from '../rules/RuleDetailsDataSources';
import { RuleDetailsExpression } from '../rules/RuleDetailsExpression';
import { RuleDetailsFederatedSources } from '../rules/RuleDetailsFederatedSources';
import { RuleDetailsMatchingInstances } from '../rules/RuleDetailsMatchingInstances';
import { RuleHealth } from '../rules/RuleHealth';
import { RuleState } from '../rules/RuleState';
const errorMessage = 'Could not find data source for rule';
const errorTitle = 'Could not view rule';
const pageTitle = 'View rule';
export function RuleViewer({ match }) {
    const styles = useStyles2(getStyles);
    const [expandQuery, setExpandQuery] = useToggle(false);
    const { id } = match.params;
    const identifier = useMemo(() => {
        if (!id) {
            throw new Error('Rule ID is required');
        }
        return ruleId.parse(id, true);
    }, [id]);
    const { loading, error, result: rule } = useCombinedRule({ ruleIdentifier: identifier });
    const runner = useMemo(() => new AlertingQueryRunner(), []);
    const data = useObservable(runner.get());
    const queries = useMemo(() => alertRuleToQueries(rule), [rule]);
    const annotations = useCleanAnnotations((rule === null || rule === void 0 ? void 0 : rule.annotations) || {});
    const [evaluationTimeRanges, setEvaluationTimeRanges] = useState({});
    const { allDataSourcesAvailable } = useAlertQueriesStatus(queries);
    const onRunQueries = useCallback(() => {
        if (queries.length > 0 && allDataSourcesAvailable) {
            const evalCustomizedQueries = queries.map((q) => {
                var _a;
                return (Object.assign(Object.assign({}, q), { relativeTimeRange: (_a = evaluationTimeRanges[q.refId]) !== null && _a !== void 0 ? _a : q.relativeTimeRange }));
            });
            runner.run(evalCustomizedQueries);
        }
    }, [queries, evaluationTimeRanges, runner, allDataSourcesAvailable]);
    useEffect(() => {
        const alertQueries = alertRuleToQueries(rule);
        const defaultEvalTimeRanges = Object.fromEntries(alertQueries.map((q) => { var _a; return [q.refId, (_a = q.relativeTimeRange) !== null && _a !== void 0 ? _a : { from: 0, to: 0 }]; }));
        setEvaluationTimeRanges(defaultEvalTimeRanges);
    }, [rule]);
    useEffect(() => {
        if (allDataSourcesAvailable && expandQuery) {
            onRunQueries();
        }
    }, [onRunQueries, allDataSourcesAvailable, expandQuery]);
    useEffect(() => {
        return () => runner.destroy();
    }, [runner]);
    const onQueryTimeRangeChange = useCallback((refId, timeRange) => {
        const newEvalTimeRanges = produce(evaluationTimeRanges, (draft) => {
            draft[refId] = timeRange;
        });
        setEvaluationTimeRanges(newEvalTimeRanges);
    }, [evaluationTimeRanges, setEvaluationTimeRanges]);
    if (!(identifier === null || identifier === void 0 ? void 0 : identifier.ruleSourceName)) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(Alert, { title: errorTitle },
                React.createElement("details", { className: styles.errorMessage }, errorMessage))));
    }
    const rulesSource = getRulesSourceByName(identifier.ruleSourceName);
    if (loading) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement(LoadingPlaceholder, { text: "Loading rule..." })));
    }
    if (error || !rulesSource) {
        return (React.createElement(Alert, { title: errorTitle },
            React.createElement("details", { className: styles.errorMessage },
                isFetchError(error) ? error.message : errorMessage,
                React.createElement("br", null))));
    }
    if (!rule) {
        return (React.createElement(RuleViewerLayout, { title: pageTitle },
            React.createElement("span", null, "Rule could not be found.")));
    }
    const isFederatedRule = isFederatedRuleGroup(rule.group);
    const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);
    return (React.createElement(React.Fragment, null,
        isFederatedRule && (React.createElement(Alert, { severity: "info", title: "This rule is part of a federated rule group." },
            React.createElement(VerticalGroup, null,
                "Federated rule groups are currently an experimental feature.",
                React.createElement(Button, { fill: "text", icon: "book" },
                    React.createElement("a", { href: "https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation" }, "Read documentation"))))),
        isProvisioned && React.createElement(ProvisioningAlert, { resource: ProvisionedResource.AlertRule }),
        React.createElement(RuleViewerLayoutContent, null,
            React.createElement("div", null,
                React.createElement(Stack, { direction: "row", alignItems: "center", wrap: false, gap: 1 },
                    React.createElement(Icon, { name: "bell", size: "lg" }),
                    " ",
                    React.createElement("span", { className: styles.title }, rule.name)),
                React.createElement(RuleState, { rule: rule, isCreating: false, isDeleting: false }),
                React.createElement(RuleDetailsActionButtons, { rule: rule, rulesSource: rulesSource, isViewMode: true })),
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
                    isFederatedRule && React.createElement(RuleDetailsFederatedSources, { group: rule.group }),
                    React.createElement(DetailsField, { label: "Namespace / Group", className: styles.rightSideDetails },
                        rule.namespace.name,
                        " / ",
                        rule.group.name),
                    isGrafanaRulerRule(rule.rulerRule) && React.createElement(GrafanaRuleUID, { rule: rule.rulerRule.grafana_alert }))),
            React.createElement("div", null,
                React.createElement(RuleDetailsMatchingInstances, { rule: rule, pagination: { itemsPerPage: DEFAULT_PER_PAGE_PAGINATION }, enableFiltering: true }))),
        React.createElement(Collapse, { label: "Query & Results", isOpen: expandQuery, onToggle: setExpandQuery, loading: data && isLoading(data), collapsible: true, className: styles.collapse },
            isGrafanaRulerRule(rule.rulerRule) && !isFederatedRule && (React.createElement(GrafanaRuleQueryViewer, { condition: rule.rulerRule.grafana_alert.condition, queries: queries, evalDataByQuery: data, evalTimeRanges: evaluationTimeRanges, onTimeRangeChange: onQueryTimeRangeChange })),
            !isGrafanaRulerRule(rule.rulerRule) && !isFederatedRule && data && Object.keys(data).length > 0 && (React.createElement("div", { className: styles.queries }, queries.map((query) => {
                return (React.createElement(QueryPreview, { key: query.refId, refId: query.refId, model: query.model, dataSource: Object.values(config.datasources).find((ds) => ds.uid === query.datasourceUid), queryData: data[query.refId], relativeTimeRange: query.relativeTimeRange, evalTimeRange: evaluationTimeRanges[query.refId], onEvalTimeRangeChange: (timeRange) => onQueryTimeRangeChange(query.refId, timeRange), isAlertCondition: false }));
            }))),
            !isFederatedRule && !allDataSourcesAvailable && (React.createElement(Alert, { title: "Query not available", severity: "warning", className: styles.queryWarning }, "Cannot display the query preview. Some of the data sources used in the queries are not available.")))));
}
function GrafanaRuleUID({ rule }) {
    const styles = useStyles2(getStyles);
    const copyUID = () => navigator.clipboard && navigator.clipboard.writeText(rule.uid);
    return (React.createElement(DetailsField, { label: "Rule UID", childrenWrapperClassName: styles.ruleUid },
        rule.uid,
        " ",
        React.createElement(IconButton, { name: "copy", onClick: copyUID, tooltip: "Copy rule UID" })));
}
function isLoading(data) {
    return !!Object.values(data).find((d) => d.state === LoadingState.Loading);
}
const getStyles = (theme) => {
    return {
        errorMessage: css `
      white-space: pre-wrap;
    `,
        queries: css `
      height: 100%;
      width: 100%;
    `,
        collapse: css `
      margin-top: ${theme.spacing(2)};
      border-color: ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
    `,
        queriesTitle: css `
      padding: ${theme.spacing(2, 0.5)};
      font-size: ${theme.typography.h5.fontSize};
      font-weight: ${theme.typography.fontWeightBold};
      font-family: ${theme.typography.h5.fontFamily};
    `,
        query: css `
      border-bottom: 1px solid ${theme.colors.border.medium};
      padding: ${theme.spacing(2)};
    `,
        queryWarning: css `
      margin: ${theme.spacing(4, 0)};
    `,
        title: css `
      font-size: ${theme.typography.h4.fontSize};
      font-weight: ${theme.typography.fontWeightBold};
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    `,
        details: css `
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(4)};
    `,
        leftSide: css `
      flex: 1;
      overflow: hidden;
    `,
        rightSide: css `
      padding-right: ${theme.spacing(3)};

      max-width: 360px;
      word-break: break-all;
      overflow: hidden;
    `,
        rightSideDetails: css `
      & > div:first-child {
        width: auto;
      }
    `,
        labels: css `
      justify-content: flex-start;
    `,
        ruleUid: css `
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
    `,
    };
};
export default RuleViewer;
//# sourceMappingURL=RuleViewer.v1.js.map