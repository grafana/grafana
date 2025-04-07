import { css } from '@emotion/css';

import { GrafanaTheme2, dateTime, dateTimeFormat } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { Time } from 'app/features/explore/Time';
import { CombinedRule } from 'app/types/unified-alerting';

import { usePendingPeriod } from '../../hooks/rules/usePendingPeriod';
import { useCleanAnnotations } from '../../utils/annotations';
import { prometheusRuleType, rulerRuleType } from '../../utils/rules';
import { isNullDate } from '../../utils/time';
import { AlertLabels } from '../AlertLabels';
import { DetailsField } from '../DetailsField';

import { RuleDetailsAnnotations } from './RuleDetailsAnnotations';
import RuleDetailsButtons from './RuleDetailsButtons';
import { RuleDetailsDataSources } from './RuleDetailsDataSources';
import { RuleDetailsExpression } from './RuleDetailsExpression';
import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';

interface Props {
  rule: CombinedRule;
}

// The limit is set to 15 in order to upkeep the good performance
// and to encourage users to go to the rule details page to see the rest of the instances
// We don't want to paginate the instances list on the alert list page
export const INSTANCES_DISPLAY_LIMIT = 15;

export const RuleDetails = ({ rule }: Props) => {
  const styles = useStyles2(getStyles);
  const {
    namespace: { rulesSource },
  } = rule;

  const annotations = useCleanAnnotations(rule.annotations);
  const isAlertingRule =
    rulerRuleType.any.alertingRule(rule.rulerRule) || prometheusRuleType.alertingRule(rule.promRule);

  return (
    <div>
      <RuleDetailsButtons rule={rule} rulesSource={rulesSource} />
      <div className={styles.wrapper}>
        <div className={styles.leftSide}>
          {<EvaluationBehaviorSummary rule={rule} />}
          {!!rule.labels && !!Object.keys(rule.labels).length && (
            <DetailsField label={t('alerting.rule-details.label-labels', 'Labels')} horizontal={true}>
              <AlertLabels labels={rule.labels} />
            </DetailsField>
          )}
          <RuleDetailsExpression rulesSource={rulesSource} rule={rule} annotations={annotations} />
          <RuleDetailsAnnotations annotations={annotations} />
        </div>
        <div className={styles.rightSide}>
          <RuleDetailsDataSources rulesSource={rulesSource} rule={rule} />
        </div>
      </div>
      {isAlertingRule && (
        <DetailsField label={t('alerting.rule-details.label-instances', 'Instances')} horizontal={true}>
          <RuleDetailsMatchingInstances rule={rule} itemsDisplayLimit={INSTANCES_DISPLAY_LIMIT} />
        </DetailsField>
      )}
    </div>
  );
};

interface EvaluationBehaviorSummaryProps {
  rule: CombinedRule;
}

const EvaluationBehaviorSummary = ({ rule }: EvaluationBehaviorSummaryProps) => {
  const every = rule.group.interval;
  const lastEvaluation = rule.promRule?.lastEvaluation;
  const lastEvaluationDuration = rule.promRule?.evaluationTime;
  const metric = rulerRuleType.grafana.recordingRule(rule.rulerRule)
    ? rule.rulerRule?.grafana_alert.record?.metric
    : undefined;

  const pendingPeriod = usePendingPeriod(rule);
  const keepFiringFor = rulerRuleType.grafana.alertingRule(rule.rulerRule) ? rule.rulerRule.keep_firing_for : undefined;

  return (
    <>
      {metric && (
        <DetailsField label={t('alerting.evaluation-behavior-summary.label-metric', 'Metric')} horizontal={true}>
          {metric}
        </DetailsField>
      )}
      {every && (
        <DetailsField label={t('alerting.evaluation-behavior-summary.label-evaluate', 'Evaluate')} horizontal={true}>
          <Trans i18nKey="alerting.evaluation-behavior-summary.evaluate" values={{ every }}>
            Every {{ every }}
          </Trans>
        </DetailsField>
      )}

      {pendingPeriod && (
        <DetailsField
          label={t('alerting.evaluation-behavior-summary.label-pending-period', 'Pending period')}
          horizontal={true}
        >
          {pendingPeriod}
        </DetailsField>
      )}
      {keepFiringFor && (
        <DetailsField label={t('alerting.rule-details.keep-firing-for', 'Keep firing for')} horizontal={true}>
          {keepFiringFor}
        </DetailsField>
      )}

      {lastEvaluation && !isNullDate(lastEvaluation) && (
        <DetailsField
          label={t('alerting.evaluation-behavior-summary.label-last-evaluation', 'Last evaluation')}
          horizontal={true}
        >
          <Tooltip
            placement="top"
            content={`${dateTimeFormat(lastEvaluation, { format: 'YYYY-MM-DD HH:mm:ss' })}`}
            theme="info"
          >
            <span>
              {t('alerting.rule-details.last-evaluation-ago', '{{time}} ago', {
                time: dateTime(lastEvaluation).locale('en').fromNow(true),
              })}
            </span>
          </Tooltip>
        </DetailsField>
      )}

      {lastEvaluation && !isNullDate(lastEvaluation) && lastEvaluationDuration !== undefined && (
        <DetailsField
          label={t('alerting.evaluation-behavior-summary.label-evaluation-time', 'Evaluation time')}
          horizontal={true}
        >
          <Tooltip placement="top" content={`${lastEvaluationDuration}s`} theme="info">
            <span>{Time({ timeInMs: lastEvaluationDuration * 1000, humanize: true })}</span>
          </Tooltip>
        </DetailsField>
      )}
    </>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'row',

    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
  }),
  leftSide: css({
    flex: 1,
  }),
  rightSide: css({
    [theme.breakpoints.up('md')]: {
      paddingLeft: '90px',
      width: '300px',
    },
  }),
});
