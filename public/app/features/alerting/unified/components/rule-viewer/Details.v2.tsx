import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';
import { isEmpty, isUndefined } from 'lodash';

import { GrafanaTheme2, dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, Link, Stack, Text, useStyles2 } from '@grafana/ui';
import { useDatasource } from 'app/features/datasources/hooks';
import { CombinedRule } from 'app/types/unified-alerting';

import { Time } from '../../../../explore/Time';
import { usePendingPeriod } from '../../hooks/rules/usePendingPeriod';
import { getAnnotations, isPausedRule, prometheusRuleType, rulerRuleType } from '../../utils/rules';
import { isNullDate } from '../../utils/time';
import { DetailText } from '../common/DetailText';

import { AnnotationValue, DetailGroup, NotificationSettings, RuleType } from './Details';
import { UpdatedByUser } from './tabs/version-history/UpdatedBy';

interface DetailsProps {
  rule: CombinedRule;
}

export const Details = ({ rule }: DetailsProps) => {
  const styles = useStyles2(getStyles);

  const pendingPeriod = usePendingPeriod(rule);
  const keepFiringFor = rulerRuleType.grafana.alertingRule(rule.rulerRule) ? rule.rulerRule.keep_firing_for : undefined;

  let determinedRuleType: RuleType = RuleType.Unknown;
  if (rulerRuleType.grafana.alertingRule(rule.rulerRule)) {
    determinedRuleType = RuleType.GrafanaManagedAlertRule;
  } else if (rulerRuleType.grafana.recordingRule(rule.rulerRule)) {
    determinedRuleType = RuleType.GrafanaManagedRecordingRule;
  } else if (rulerRuleType.dataSource.alertingRule(rule.rulerRule)) {
    determinedRuleType = RuleType.CloudAlertRule;
  } else if (rulerRuleType.dataSource.recordingRule(rule.rulerRule)) {
    determinedRuleType = RuleType.CloudRecordingRule;
  }

  const targetDatasourceUid = rulerRuleType.grafana.recordingRule(rule.rulerRule)
    ? rule.rulerRule.grafana_alert.record?.target_datasource_uid
    : null;

  const datasource = useDatasource(targetDatasourceUid);

  const showTargetDatasource = targetDatasourceUid && targetDatasourceUid !== 'grafana';

  const evaluationDuration = rule.promRule?.evaluationTime;
  const evaluationTimestamp = rule.promRule?.lastEvaluation;

  const annotations = prometheusRuleType.alertingRule(rule.promRule) ? getAnnotations(rule.promRule) : undefined;

  const hasEvaluationDuration = Number.isFinite(evaluationDuration);

  const updated = rulerRuleType.grafana.rule(rule.rulerRule) ? rule.rulerRule.grafana_alert.updated : undefined;
  const isPaused = rulerRuleType.grafana.rule(rule.rulerRule) && isPausedRule(rule.rulerRule);

  const missingSeriesEvalsToResolve =
    rulerRuleType.grafana.rule(rule.rulerRule) &&
    !isUndefined(rule.rulerRule.grafana_alert.missing_series_evals_to_resolve)
      ? String(rule.rulerRule.grafana_alert.missing_series_evals_to_resolve)
      : undefined;

  const interval = rule.group.interval;

  const pausedIcon = (
    <Stack>
      <Text color="warning">
        <Icon name="pause-circle" />
      </Text>
      <Text>
        <Trans i18nKey="alerting.alert.evaluation-paused">Alert evaluation currently paused</Trans>
      </Text>
    </Stack>
  );
  return (
    <div className={styles.metadata}>
      {/* 1. Evaluation — operationally most important */}
      <DetailGroup title={t('alerting.alert.evaluation', 'Evaluation')}>
        {interval && (
          <DetailText
            id="evaluation-interval"
            label={t('alerting.alert.evaluation-interval', 'Evaluation interval')}
            value={interval}
          />
        )}
        {isPaused ? (
          pausedIcon
        ) : (
          <>
            {hasEvaluationDuration && evaluationTimestamp && (
              <DetailText
                id="last-evaluated"
                label={t('alerting.alert.last-evaluated', 'Last evaluated')}
                value={
                  !isNullDate(evaluationTimestamp)
                    ? formatDistanceToNowStrict(new Date(evaluationTimestamp), { addSuffix: true })
                    : '-'
                }
                tooltipValue={!isNullDate(evaluationTimestamp) ? dateTimeFormat(evaluationTimestamp) : undefined}
              />
            )}
            {hasEvaluationDuration && (
              <DetailText
                id="last-evaluation-duration"
                label={t('alerting.alert.last-evaluation-duration', 'Last evaluation duration')}
                value={Time({ timeInMs: evaluationDuration! * 1000, humanize: true })}
                tooltipValue={`${evaluationDuration}s`}
              />
            )}
            {missingSeriesEvalsToResolve && (
              <DetailText
                id="missing-series-resolve"
                label={t('alerting.alert.missing-series-resolve', 'Missing series evaluations to resolve')}
                value={missingSeriesEvalsToResolve}
                tooltipValue={t(
                  'alerting.alert.description-missing-series-evaluations',
                  'The number of consecutive evaluation intervals a dimension must be missing before the alert instance becomes stale, and is then automatically resolved and evicted. Defaults to 2 if empty.'
                )}
              />
            )}
          </>
        )}

        {pendingPeriod && (
          <DetailText
            id="pending-period"
            label={t('alerting.alert.pending-period', 'Pending period')}
            value={pendingPeriod}
          />
        )}
        {keepFiringFor && (
          <DetailText
            id="keep-firing-for"
            label={t('alerting.alert.keep-firing-for', 'Keep firing for')}
            value={keepFiringFor}
          />
        )}
      </DetailGroup>

      {/* 2. Notification configuration */}
      {rulerRuleType.grafana.alertingRule(rule.rulerRule) &&
        (!isEmpty(rule.rulerRule.grafana_alert.notification_settings) ||
          config.featureToggles.alertingPolicyRoutingSettings) && <NotificationSettings rulerRule={rule.rulerRule} />}

      {/* 3. Alert state */}
      {rulerRuleType.grafana.rule(rule.rulerRule) &&
        rule.rulerRule.grafana_alert.no_data_state &&
        rule.rulerRule.grafana_alert.exec_err_state && (
          <DetailGroup title={t('alerting.alert.alert-state', 'Alert state')}>
            {hasEvaluationDuration && (
              <DetailText
                id="alert-state-no-data"
                label={t('alerting.alert.state-no-data', 'Alert state if no data or all values are null')}
                value={rule.rulerRule.grafana_alert.no_data_state}
              />
            )}
            {pendingPeriod && (
              <DetailText
                id="alert-state-exec-err"
                label={t('alerting.alert.state-error-timeout', 'Alert state if execution error or timeout')}
                value={rule.rulerRule.grafana_alert.exec_err_state}
              />
            )}
          </DetailGroup>
        )}

      {/* 4. Annotations */}
      {annotations && (
        <DetailGroup title={t('alerting.alert.annotations', 'Annotations')}>
          {Object.keys(annotations).length === 0 ? (
            <div>
              <Text color="secondary">
                <Trans i18nKey="alerting.alert.no-annotations">No annotations</Trans>
              </Text>
            </div>
          ) : (
            Object.entries(annotations).map(([name, value]) => {
              const id = `annotation-${name.replace(/\s/g, '-')}`;
              return <DetailText id={id} key={name} label={name} value={<AnnotationValue value={value} />} />;
            })
          )}
        </DetailGroup>
      )}

      {/* 5. Rule metadata — demoted to last */}
      <DetailGroup title={t('alerting.alert.rule-metadata', 'Rule metadata')}>
        <DetailText id="rule-type" label={t('alerting.alert.rule-type', 'Rule type')} value={determinedRuleType} />
        {rulerRuleType.grafana.rule(rule.rulerRule) && (
          <>
            <DetailText
              id="rule-type"
              label={t('alerting.alert.rule-identifier', 'Rule identifier')}
              value={rule.rulerRule.grafana_alert.uid}
              monospace
              showCopyButton
              copyValue={rule.rulerRule.grafana_alert.uid}
            />
            <DetailText
              id="last-updated-by"
              label={t('alerting.alert.last-updated-by', 'Last updated by')}
              value={<UpdatedByUser user={rule.rulerRule.grafana_alert.updated_by} />}
            />
            {updated && (
              <DetailText
                id="date-of-last-update"
                label={t('alerting.alert.last-updated-at', 'Last updated at')}
                value={dateTimeFormat(updated) + ` (${dateTimeFormatTimeAgo(updated)})`}
              />
            )}
          </>
        )}
        {showTargetDatasource && (
          <DetailText
            id="target-datasource-uid"
            label={t('alerting.alert.target-datasource-uid', 'Target data source')}
            value={
              <Link href={`/connections/datasources/edit/${datasource?.uid}`}>
                <Stack direction="row" gap={1}>
                  <img style={{ width: '16px' }} src={datasource?.meta.info.logos.small} alt="datasource logo" />
                  {datasource?.name}
                </Stack>
              </Link>
            }
          />
        )}
      </DetailGroup>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  metadata: css({
    display: 'grid',
    gap: theme.spacing(4),
    gridTemplateColumns: '1fr',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  }),
});
