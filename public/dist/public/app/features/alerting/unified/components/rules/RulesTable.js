import { css, cx } from '@emotion/css';
import { isBefore, formatDuration } from 'date-fns';
import React, { useCallback, useMemo } from 'react';
import { addDurationToDate, isValidDate, isValidDuration, parseDuration, dateTimeFormat, dateTime, } from '@grafana/data';
import { useStyles2, Tooltip } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { useHasRuler } from '../../hooks/useHasRuler';
import { Annotation } from '../../utils/constants';
import { isGrafanaRulerRule, isGrafanaRulerRulePaused } from '../../utils/rules';
import { DynamicTable } from '../DynamicTable';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
import { ProvisioningBadge } from '../Provisioning';
import { RuleLocation } from '../RuleLocation';
import { Tokenize } from '../Tokenize';
import { RuleActionsButtons } from './RuleActionsButtons';
import { RuleConfigStatus } from './RuleConfigStatus';
import { RuleDetails } from './RuleDetails';
import { RuleHealth } from './RuleHealth';
import { RuleState } from './RuleState';
export const RulesTable = ({ rules, className, showGuidelines = false, emptyMessage = 'No rules found.', showGroupColumn = false, showSummaryColumn = false, showNextEvaluationColumn = false, }) => {
    const styles = useStyles2(getStyles);
    const wrapperClass = cx(styles.wrapper, className, { [styles.wrapperMargin]: showGuidelines });
    const items = useMemo(() => {
        return rules.map((rule, ruleIdx) => {
            return {
                id: `${rule.namespace.name}-${rule.group.name}-${rule.name}-${ruleIdx}`,
                data: rule,
            };
        });
    }, [rules]);
    const columns = useColumns(showSummaryColumn, showGroupColumn, showNextEvaluationColumn);
    if (!rules.length) {
        return React.createElement("div", { className: cx(wrapperClass, styles.emptyMessage) }, emptyMessage);
    }
    const TableComponent = showGuidelines ? DynamicTableWithGuidelines : DynamicTable;
    return (React.createElement("div", { className: wrapperClass, "data-testid": "rules-table" },
        React.createElement(TableComponent, { cols: columns, isExpandable: true, items: items, renderExpandedContent: ({ data: rule }) => React.createElement(RuleDetails, { rule: rule }), pagination: { itemsPerPage: DEFAULT_PER_PAGE_PAGINATION }, paginationStyles: styles.pagination })));
};
export const getStyles = (theme) => ({
    wrapperMargin: css `
    ${theme.breakpoints.up('md')} {
      margin-left: 36px;
    }
  `,
    emptyMessage: css `
    padding: ${theme.spacing(1)};
  `,
    wrapper: css `
    width: auto;
    border-radius: ${theme.shape.radius.default};
  `,
    pagination: css `
    display: flex;
    margin: 0;
    padding-top: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(0.25)};
    justify-content: center;
    border-left: 1px solid ${theme.colors.border.medium};
    border-right: 1px solid ${theme.colors.border.medium};
    border-bottom: 1px solid ${theme.colors.border.medium};
  `,
});
function useColumns(showSummaryColumn, showGroupColumn, showNextEvaluationColumn) {
    const { hasRuler, rulerRulesLoaded } = useHasRuler();
    const calculateNextEvaluationDate = useCallback((rule) => {
        var _a, _b;
        const isValidLastEvaluation = ((_a = rule.promRule) === null || _a === void 0 ? void 0 : _a.lastEvaluation) && isValidDate(rule.promRule.lastEvaluation);
        const isValidIntervalDuration = rule.group.interval && isValidDuration(rule.group.interval);
        if (!isValidLastEvaluation || !isValidIntervalDuration || isGrafanaRulerRulePaused(rule)) {
            return;
        }
        const intervalDuration = parseDuration(rule.group.interval);
        const lastEvaluationDate = Date.parse(((_b = rule.promRule) === null || _b === void 0 ? void 0 : _b.lastEvaluation) || '');
        const nextEvaluationDate = addDurationToDate(lastEvaluationDate, intervalDuration);
        //when `nextEvaluationDate` is a past date it means lastEvaluation was more than one evaluation interval ago.
        //in this case we use the interval value to show a more generic estimate.
        //See https://github.com/grafana/grafana/issues/65125
        const isPastDate = isBefore(nextEvaluationDate, new Date());
        if (isPastDate) {
            return {
                humanized: `within ${formatDuration(intervalDuration)}`,
                fullDate: `within ${formatDuration(intervalDuration)}`,
            };
        }
        return {
            humanized: `in ${dateTime(nextEvaluationDate).locale('en').fromNow(true)}`,
            fullDate: dateTimeFormat(nextEvaluationDate, { format: 'YYYY-MM-DD HH:mm:ss' }),
        };
    }, []);
    return useMemo(() => {
        const columns = [
            {
                id: 'state',
                label: 'State',
                // eslint-disable-next-line react/display-name
                renderCell: ({ data: rule }) => {
                    const { namespace } = rule;
                    const { rulesSource } = namespace;
                    const { promRule, rulerRule } = rule;
                    const isDeleting = !!(hasRuler(rulesSource) && rulerRulesLoaded(rulesSource) && promRule && !rulerRule);
                    const isCreating = !!(hasRuler(rulesSource) && rulerRulesLoaded(rulesSource) && rulerRule && !promRule);
                    const isPaused = isGrafanaRulerRulePaused(rule);
                    return React.createElement(RuleState, { rule: rule, isDeleting: isDeleting, isCreating: isCreating, isPaused: isPaused });
                },
                size: '165px',
            },
            {
                id: 'name',
                label: 'Name',
                // eslint-disable-next-line react/display-name
                renderCell: ({ data: rule }) => rule.name,
                size: showNextEvaluationColumn ? 4 : 5,
            },
            {
                id: 'provisioned',
                label: '',
                // eslint-disable-next-line react/display-name
                renderCell: ({ data: rule }) => {
                    const rulerRule = rule.rulerRule;
                    const isGrafanaManagedRule = isGrafanaRulerRule(rulerRule);
                    if (!isGrafanaManagedRule) {
                        return null;
                    }
                    const provenance = rulerRule.grafana_alert.provenance;
                    return provenance ? React.createElement(ProvisioningBadge, null) : null;
                },
                size: '100px',
            },
            {
                id: 'warnings',
                label: '',
                renderCell: ({ data: combinedRule }) => React.createElement(RuleConfigStatus, { rule: combinedRule }),
                size: '45px',
            },
            {
                id: 'health',
                label: 'Health',
                // eslint-disable-next-line react/display-name
                renderCell: ({ data: { promRule, group } }) => (promRule ? React.createElement(RuleHealth, { rule: promRule }) : null),
                size: '75px',
            },
        ];
        if (showSummaryColumn) {
            columns.push({
                id: 'summary',
                label: 'Summary',
                // eslint-disable-next-line react/display-name
                renderCell: ({ data: rule }) => {
                    var _a;
                    return React.createElement(Tokenize, { input: (_a = rule.annotations[Annotation.summary]) !== null && _a !== void 0 ? _a : '' });
                },
                size: showNextEvaluationColumn ? 4 : 5,
            });
        }
        if (showNextEvaluationColumn) {
            columns.push({
                id: 'nextEvaluation',
                label: 'Next evaluation',
                renderCell: ({ data: rule }) => {
                    const nextEvalInfo = calculateNextEvaluationDate(rule);
                    return (nextEvalInfo && (React.createElement(Tooltip, { placement: "top", content: `${nextEvalInfo === null || nextEvalInfo === void 0 ? void 0 : nextEvalInfo.fullDate}`, theme: "info" },
                        React.createElement("span", null, nextEvalInfo === null || nextEvalInfo === void 0 ? void 0 : nextEvalInfo.humanized))));
                },
                size: 2,
            });
        }
        if (showGroupColumn) {
            columns.push({
                id: 'group',
                label: 'Group',
                // eslint-disable-next-line react/display-name
                renderCell: ({ data: rule }) => {
                    const { namespace, group } = rule;
                    // ungrouped rules are rules that are in the "default" group name
                    const isUngrouped = group.name === 'default';
                    const groupName = isUngrouped ? (React.createElement(RuleLocation, { namespace: namespace.name })) : (React.createElement(RuleLocation, { namespace: namespace.name, group: group.name }));
                    return groupName;
                },
                size: 5,
            });
        }
        columns.push({
            id: 'actions',
            label: 'Actions',
            // eslint-disable-next-line react/display-name
            renderCell: ({ data: rule }) => {
                return React.createElement(RuleActionsButtons, { rule: rule, rulesSource: rule.namespace.rulesSource });
            },
            size: '200px',
        });
        return columns;
    }, [
        showSummaryColumn,
        showGroupColumn,
        showNextEvaluationColumn,
        hasRuler,
        rulerRulesLoaded,
        calculateNextEvaluationDate,
    ]);
}
//# sourceMappingURL=RulesTable.js.map