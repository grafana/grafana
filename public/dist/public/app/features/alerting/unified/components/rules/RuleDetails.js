import { css } from '@emotion/css';
import React from 'react';
import { dateTime, dateTimeFormat } from '@grafana/data';
import { useStyles2, Tooltip } from '@grafana/ui';
import { Time } from 'app/features/explore/Time';
import { useCleanAnnotations } from '../../utils/annotations';
import { isRecordingRulerRule } from '../../utils/rules';
import { isNullDate } from '../../utils/time';
import { AlertLabels } from '../AlertLabels';
import { DetailsField } from '../DetailsField';
import { RuleDetailsActionButtons } from './RuleDetailsActionButtons';
import { RuleDetailsAnnotations } from './RuleDetailsAnnotations';
import { RuleDetailsDataSources } from './RuleDetailsDataSources';
import { RuleDetailsExpression } from './RuleDetailsExpression';
import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';
// The limit is set to 15 in order to upkeep the good performance
// and to encourage users to go to the rule details page to see the rest of the instances
// We don't want to paginate the instances list on the alert list page
export const INSTANCES_DISPLAY_LIMIT = 15;
export const RuleDetails = ({ rule }) => {
    const styles = useStyles2(getStyles);
    const { namespace: { rulesSource }, } = rule;
    const annotations = useCleanAnnotations(rule.annotations);
    return (React.createElement("div", null,
        React.createElement(RuleDetailsActionButtons, { rule: rule, rulesSource: rulesSource, isViewMode: false }),
        React.createElement("div", { className: styles.wrapper },
            React.createElement("div", { className: styles.leftSide },
                React.createElement(EvaluationBehaviorSummary, { rule: rule }),
                !!rule.labels && !!Object.keys(rule.labels).length && (React.createElement(DetailsField, { label: "Labels", horizontal: true },
                    React.createElement(AlertLabels, { labels: rule.labels }))),
                React.createElement(RuleDetailsExpression, { rulesSource: rulesSource, rule: rule, annotations: annotations }),
                React.createElement(RuleDetailsAnnotations, { annotations: annotations })),
            React.createElement("div", { className: styles.rightSide },
                React.createElement(RuleDetailsDataSources, { rulesSource: rulesSource, rule: rule }))),
        React.createElement(RuleDetailsMatchingInstances, { rule: rule, itemsDisplayLimit: INSTANCES_DISPLAY_LIMIT })));
};
const EvaluationBehaviorSummary = ({ rule }) => {
    var _a, _b, _c;
    let forDuration;
    let every = rule.group.interval;
    let lastEvaluation = (_a = rule.promRule) === null || _a === void 0 ? void 0 : _a.lastEvaluation;
    let lastEvaluationDuration = (_b = rule.promRule) === null || _b === void 0 ? void 0 : _b.evaluationTime;
    // recording rules don't have a for duration
    if (!isRecordingRulerRule(rule.rulerRule)) {
        forDuration = (_c = rule.rulerRule) === null || _c === void 0 ? void 0 : _c.for;
    }
    return (React.createElement(React.Fragment, null,
        every && (React.createElement(DetailsField, { label: "Evaluate", horizontal: true },
            "Every ",
            every)),
        forDuration && (React.createElement(DetailsField, { label: "For", horizontal: true }, forDuration)),
        lastEvaluation && !isNullDate(lastEvaluation) && (React.createElement(DetailsField, { label: "Last evaluation", horizontal: true },
            React.createElement(Tooltip, { placement: "top", content: `${dateTimeFormat(lastEvaluation, { format: 'YYYY-MM-DD HH:mm:ss' })}`, theme: "info" },
                React.createElement("span", null, `${dateTime(lastEvaluation).locale('en').fromNow(true)} ago`)))),
        lastEvaluation && !isNullDate(lastEvaluation) && lastEvaluationDuration !== undefined && (React.createElement(DetailsField, { label: "Evaluation time", horizontal: true },
            React.createElement(Tooltip, { placement: "top", content: `${lastEvaluationDuration}s`, theme: "info" },
                React.createElement("span", null, Time({ timeInMs: lastEvaluationDuration * 1000, humanize: true })))))));
};
export const getStyles = (theme) => ({
    wrapper: css `
    display: flex;
    flex-direction: row;

    ${theme.breakpoints.down('md')} {
      flex-direction: column;
    }
  `,
    leftSide: css `
    flex: 1;
  `,
    rightSide: css `
    ${theme.breakpoints.up('md')} {
      padding-left: 90px;
      width: 300px;
    }
  `,
});
//# sourceMappingURL=RuleDetails.js.map