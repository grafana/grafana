import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';
import React, { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Text, Stack, useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';
import { Annotations } from 'app/types/unified-alerting-dto';

import { isGrafanaRulerRule, isRecordingRulerRule } from '../../../utils/rules';
import { MetaText } from '../../MetaText';

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
    if (navigator.clipboard && isGrafanaRulerRule(rule.rulerRule)) {
      navigator.clipboard.writeText(rule.rulerRule.grafana_alert.uid);
    }
  }, [rule.rulerRule]);

  const annotations: Annotations | undefined = !isRecordingRulerRule(rule.rulerRule)
    ? rule.annotations ?? []
    : undefined;

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
                  {rule.rulerRule.grafana_alert.uid}{' '}
                  <Button
                    fill="text"
                    variant="secondary"
                    icon="copy"
                    size="sm"
                    onClick={() => copyRuleUID()}
                    tooltip="Copy to clipboard"
                    tooltipPlacement="top"
                  />
                </Text>
              </Stack>
            </>
          )}
        </MetaText>

        {/* evaluation duration and pending period */}
        <MetaText direction="column">
          {evaluationDuration && (
            <>
              Last evaluation
              {evaluationTimestamp && evaluationDuration && (
                <span>
                  <Text color="primary">{formatDistanceToNowStrict(new Date(evaluationTimestamp))}</Text> ago, took{' '}
                  <Text color="primary">{evaluationDuration}</Text> ms
                </span>
              )}
            </>
          )}
        </MetaText>
        <MetaText direction="column">
          {!isRecordingRulerRule(rule.rulerRule) && (
            <>
              Pending period
              <Text color="primary">{rule.rulerRule?.for ?? '0s'}</Text>
            </>
          )}
        </MetaText>

        {/* nodata and execution error state mapping */}
        <MetaText direction="column">
          {isGrafanaRulerRule(rule.rulerRule) && (
            <>
              Alert state if no data or all values are null
              <Text color="primary">{rule.rulerRule.grafana_alert.no_data_state}</Text>
            </>
          )}
        </MetaText>
        <MetaText direction="column">
          {isGrafanaRulerRule(rule.rulerRule) && (
            <>
              Alert state if execution error or timeout
              <Text color="primary">{rule.rulerRule.grafana_alert.exec_err_state}</Text>
            </>
          )}
        </MetaText>
      </div>

      {/* annotations go here */}
      {annotations && (
        <>
          <Text variant="h4">Annotations</Text>
          {Object.keys(annotations).length === 0 ? (
            <Text variant="bodySmall" color="secondary">
              No annotations
            </Text>
          ) : (
            <div className={styles.metadataWrapper}>
              {Object.entries(annotations).map(([name, value]) => (
                <MetaText direction="column" key={name}>
                  {name}
                  <Text color="primary">{value}</Text>
                </MetaText>
              ))}
            </div>
          )}
        </>
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  metadataWrapper: css({
    display: 'grid',
    gridTemplateColumns: 'max-content max-content',
    rowGap: theme.spacing(3),
    columnGap: theme.spacing(12),
  }),
});

export { Details };
