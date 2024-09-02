import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ClipboardButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';
import { Annotations } from 'app/types/unified-alerting-dto';

import { usePendingPeriod } from '../../../hooks/rules/usePendingPeriod';
import { isGrafanaRulerRule, isRecordingRulerRule } from '../../../utils/rules';
import { MetaText } from '../../MetaText';
import { Tokenize } from '../../Tokenize';

interface DetailsProps {
  rule: CombinedRule;
}

enum RuleType {
  GrafanaManagedAlertRule = 'Grafana-managed alert rule',
  CloudAlertRule = 'Cloud alert rule',
  CloudRecordingRule = 'Cloud recording rule',
}

const Details = ({ rule }: DetailsProps) => {
  const styles = useStyles2(getStyles);

  let ruleType: RuleType;

  const pendingPeriod = usePendingPeriod(rule);

  if (isGrafanaRulerRule(rule.rulerRule)) {
    ruleType = RuleType.GrafanaManagedAlertRule;
  } else if (isRecordingRulerRule(rule.rulerRule)) {
    ruleType = RuleType.CloudRecordingRule;
  } else {
    // probably not the greatest assumption
    ruleType = RuleType.CloudAlertRule;
  }

  const evaluationDuration = rule.promRule?.evaluationTime;
  const evaluationTimestamp = rule.promRule?.lastEvaluation;

  const copyRuleUID = useCallback(() => {
    if (isGrafanaRulerRule(rule.rulerRule)) {
      return rule.rulerRule.grafana_alert.uid;
    } else {
      return '';
    }
  }, [rule.rulerRule]);

  const annotations: Annotations | undefined = !isRecordingRulerRule(rule.rulerRule)
    ? (rule.annotations ?? [])
    : undefined;

  const hasEvaluationDuration = Number.isFinite(evaluationDuration);

  return (
    <Stack direction="column" gap={3}>
      <div className={styles.metadataWrapper}>
        {/* type and identifier (optional) */}
        <MetaText direction="column">
          Rule type
          <Text color="primary">{ruleType}</Text>
        </MetaText>
        <MetaText direction="column">
          {isGrafanaRulerRule(rule.rulerRule) && (
            <>
              Rule Identifier
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Text color="primary">
                  {rule.rulerRule.grafana_alert.uid}
                  <ClipboardButton fill="text" variant="secondary" icon="copy" size="sm" getText={copyRuleUID} />
                </Text>
              </Stack>
            </>
          )}
        </MetaText>

        {/* evaluation duration and pending period */}
        <MetaText direction="column">
          {hasEvaluationDuration && (
            <>
              Last evaluation
              {evaluationTimestamp && evaluationDuration ? (
                <span>
                  <Text color="primary">{formatDistanceToNowStrict(new Date(evaluationTimestamp))} ago</Text>, took{' '}
                  <Text color="primary">{evaluationDuration}ms</Text>
                </span>
              ) : null}
            </>
          )}
        </MetaText>
        <MetaText direction="column">
          {pendingPeriod && (
            <>
              Pending period
              <Text color="primary">{pendingPeriod}</Text>
            </>
          )}
        </MetaText>

        {/* nodata and execution error state mapping */}
        {isGrafanaRulerRule(rule.rulerRule) &&
          // grafana recording rules don't have these fields
          rule.rulerRule.grafana_alert.no_data_state &&
          rule.rulerRule.grafana_alert.exec_err_state && (
            <>
              <MetaText direction="column">
                Alert state if no data or all values are null
                <Text color="primary">{rule.rulerRule.grafana_alert.no_data_state}</Text>
              </MetaText>
              <MetaText direction="column">
                Alert state if execution error or timeout
                <Text color="primary">{rule.rulerRule.grafana_alert.exec_err_state}</Text>
              </MetaText>
            </>
          )}
      </div>

      {/* annotations go here */}
      {annotations && (
        <>
          <Text variant="h4">Annotations</Text>
          {Object.keys(annotations).length === 0 ? (
            <Text variant="bodySmall" color="secondary" italic>
              No annotations
            </Text>
          ) : (
            <div className={styles.metadataWrapper}>
              {Object.entries(annotations).map(([name, value]) => (
                <MetaText direction="column" key={name}>
                  {name}
                  <AnnotationValue value={value} />
                </MetaText>
              ))}
            </div>
          )}
        </>
      )}
    </Stack>
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
      <TextLink variant="bodySmall" href={value} external>
        {value}
      </TextLink>
    );
  }

  return <Text color="primary">{tokenizeValue}</Text>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  metadataWrapper: css({
    display: 'grid',
    gridTemplateColumns: 'auto auto',
    rowGap: theme.spacing(3),
    columnGap: theme.spacing(12),
  }),
});

export { Details };
