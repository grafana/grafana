import { css, cx } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { useGetAlertRuleQuery, useGetRecordingRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Box, Card, Text, TextLink, useStyles2 } from '@grafana/ui';

import { grafanaRulesNav } from '../../utils/navigation';
import { RuleRecordedMetric } from '../recording-rules/RuleRecordedMetric';
import { RuleLabels } from '../rule-row/RuleLabels';
import { type RuleKind } from '../shared/ruleKind';

interface RuleStepProps {
  kind: RuleKind;
  uid: string;
  step: number;
  isCurrent: boolean;
}

/** Loads one member rule; only the query for its kind runs. */
export function RuleStep({ kind, uid, step, isCurrent }: RuleStepProps) {
  const alert = useGetAlertRuleQuery(kind === 'alert' ? { name: uid } : skipToken);
  const recording = useGetRecordingRuleQuery(kind === 'recording' ? { name: uid } : skipToken);
  const { currentData: rule, isLoading, isError } = kind === 'alert' ? alert : recording;

  if (isLoading) {
    return (
      <SequenceStep step={step} isCurrent={isCurrent} title={<Skeleton width={160} />} aria-busy>
        <Skeleton width={96} />
      </SequenceStep>
    );
  }
  if (isError || !rule) {
    return (
      <SequenceStep step={step} isCurrent={isCurrent} title={<Text color="secondary">{uid}</Text>} aria-label={uid}>
        <Text color="secondary" variant="bodySmall" italic>
          {t('alerting.gma-rule-list.sequence-drawer.missing-rule', 'Rule not found or not accessible')}
        </Text>
      </SequenceStep>
    );
  }

  const recordingSpec = recording.currentData?.spec;

  return (
    <SequenceStep
      step={step}
      isCurrent={isCurrent}
      aria-label={rule.spec.title}
      title={
        <TextLink href={grafanaRulesNav.viewLink(uid, { includeReturnTo: true })} color="primary" inline={false}>
          {rule.spec.title}
        </TextLink>
      }
    >
      {recordingSpec && (
        <RuleRecordedMetric metric={recordingSpec.metric} targetDatasourceUID={recordingSpec.targetDatasourceUID} />
      )}
      {rule.spec.labels && <RuleLabels labels={rule.spec.labels} />}
    </SequenceStep>
  );
}

interface SequenceStepProps {
  step: number;
  isCurrent: boolean;
  title: ReactNode;
  /** The step's details, shown in the card's meta row. */
  children: ReactNode;
  'aria-label'?: string;
  'aria-busy'?: boolean;
}

/** One rule as a card, numbered by its place in the evaluation order. */
function SequenceStep({ step, isCurrent, title, children, ...ariaAttributes }: SequenceStepProps) {
  const styles = useStyles2(getStyles);

  return (
    // display block drops the list marker, which the card's number replaces.
    <Box element="li" display="block" aria-current={isCurrent || undefined} {...ariaAttributes}>
      <Card isCompact noMargin className={cx(isCurrent && styles.currentCard)}>
        <Card.Figure align="center" className={styles.figure}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            width={NUMBER_SIZE}
            height={NUMBER_SIZE}
            borderStyle="solid"
            borderColor={isCurrent ? 'info' : 'medium'}
            borderRadius="circle"
            aria-hidden
          >
            <Text variant="bodySmall" color={isCurrent ? 'link' : 'secondary'}>
              {step}
            </Text>
          </Box>
        </Card.Figure>
        <Card.Heading>{title}</Card.Heading>
        {isCurrent && (
          <Card.Tags>
            <Badge color="blue" text={t('alerting.gma-rule-list.sequence-drawer.this-rule', 'This rule')} />
          </Card.Tags>
        )}
        <Card.Meta>{children}</Card.Meta>
      </Card>
    </Box>
  );
}

const NUMBER_SIZE = 3.5;

// Card.Figure and Card take no props for a narrower figure or a highlighted border.
const getStyles = (theme: GrafanaTheme2) => ({
  figure: css({
    width: theme.spacing(NUMBER_SIZE),
    marginRight: theme.spacing(1.5),
  }),
  currentCard: css({
    border: `1px solid ${theme.colors.primary.border}`,
  }),
});
