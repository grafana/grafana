import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';

import { GrafanaTheme2, dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Box, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { CombinedRule } from 'app/types/unified-alerting';

import { usePendingPeriod } from '../../../hooks/rules/usePendingPeriod';
import { getAnnotations, isGrafanaRecordingRule, isGrafanaRulerRule, isRecordingRulerRule } from '../../../utils/rules';
import { Tokenize } from '../../Tokenize';
import { DetailText } from '../../common/DetailText';

enum RuleType {
  GrafanaManagedAlertRule = 'Grafana-managed alert rule',
  GrafanaManagedRecordingRule = 'Grafana-managed recording rule',
  CloudAlertRule = 'Cloud alert rule',
  CloudRecordingRule = 'Cloud recording rule',
}

const DetailHeading = ({ label }: { label: string }) => <Text variant="h4">{label}</Text>;

interface DetailsProps {
  rule: CombinedRule;
}

export const Details = ({ rule }: DetailsProps) => {
  const styles = useStyles2(getStyles);

  let ruleType: RuleType;

  const pendingPeriod = usePendingPeriod(rule);

  if (isGrafanaRulerRule(rule.rulerRule)) {
    ruleType = isGrafanaRecordingRule(rule.rulerRule)
      ? RuleType.GrafanaManagedRecordingRule
      : RuleType.GrafanaManagedAlertRule;
  } else if (isRecordingRulerRule(rule.rulerRule)) {
    ruleType = RuleType.CloudRecordingRule;
  } else {
    // probably not the greatest assumption
    ruleType = RuleType.CloudAlertRule;
  }

  const evaluationDuration = rule.promRule?.evaluationTime;
  const evaluationTimestamp = rule.promRule?.lastEvaluation;

  const annotations = getAnnotations(rule);

  const hasEvaluationDuration = Number.isFinite(evaluationDuration);

  const lastUpdatedBy = (() => {
    if (!isGrafanaRulerRule(rule.rulerRule)) {
      return null;
    }

    return rule.rulerRule.grafana_alert.updated_by?.name || `User ID: ${rule.rulerRule.grafana_alert.updated_by?.uid}`;
  })();

  const updated = isGrafanaRulerRule(rule.rulerRule) ? rule.rulerRule.grafana_alert.updated : undefined;

  return (
    <div className={styles.metadata}>
      <Box>
        <DetailHeading label={t('alerting.alert.rule', 'Rule')} />
        <Stack direction="column" gap={2}>
          <DetailText id="rule-type" label={t('alerting.alert.rule-type', 'Rule type')} value={ruleType} />
          {isGrafanaRulerRule(rule.rulerRule) && (
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
                value={lastUpdatedBy}
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
        </Stack>
      </Box>
      <Box>
        <DetailHeading label={t('alerting.alert.evaluation', 'Evaluation')} />
        <Stack direction="column" gap={2}>
          {evaluationTimestamp && (
            <DetailText
              id="last-evaluated"
              label={t('alerting.alert.last-evaluated', 'Last evaluated')}
              value={formatDistanceToNowStrict(new Date(evaluationTimestamp), { addSuffix: true })}
              tooltipValue={dateTimeFormat(evaluationTimestamp)}
            />
          )}
          {hasEvaluationDuration && (
            <DetailText
              id="last-evaluation-duration"
              label={t('alerting.alert.last-evaluation-duration', 'Last evaluation duration')}
              value={`${evaluationDuration} ms`}
            />
          )}
          {pendingPeriod && (
            <DetailText
              id="pending-period"
              label={t('alerting.alert.pending-period', 'Pending period')}
              value={pendingPeriod}
            />
          )}
        </Stack>
      </Box>

      {isGrafanaRulerRule(rule.rulerRule) &&
        // grafana recording rules don't have these fields
        rule.rulerRule.grafana_alert.no_data_state &&
        rule.rulerRule.grafana_alert.exec_err_state && (
          <Box>
            <DetailHeading label={t('alerting.alert.alert-state', 'Alert state')} />
            <Stack direction="column" gap={2}>
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
            </Stack>
          </Box>
        )}

      {annotations && (
        <Box>
          <DetailHeading label={t('alerting.alert.annotations', 'Annotations')} />
          <Stack direction="column" gap={2}>
            {Object.keys(annotations).length === 0 ? (
              <div>
                <Text color="secondary" italic>
                  <Trans i18nKey="alerting.alert.no-annotations">No annotations</Trans>
                </Text>
              </div>
            ) : (
              Object.entries(annotations).map(([name, value]) => {
                const id = `annotation-${name.replace(/\s/g, '-')}`;
                return <DetailText id={id} key={name} label={name} value={<AnnotationValue value={value} />} />;
              })
            )}
          </Stack>
        </Box>
      )}
    </div>
  );
};

interface AnnotationValueProps {
  value: string;
}

export function AnnotationValue({ value }: AnnotationValueProps) {
  const needsExternalLink = value && value.startsWith('http');
  const tokenizeValue = <Tokenize input={value} delimiter={['{{', '}}']} />;

  if (needsExternalLink) {
    return (
      <TextLink href={value} external>
        {value}
      </TextLink>
    );
  }

  return <Text color="primary">{tokenizeValue}</Text>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  metadata: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: '1fr 1fr 1fr',

    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr 1fr',
    },
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
    },
  }),
});
