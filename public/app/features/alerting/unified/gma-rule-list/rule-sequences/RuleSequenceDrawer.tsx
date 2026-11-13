import { css, cx } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { type ReactNode, createContext, useContext, useId, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import {
  type RuleSequenceRuleRef,
  useGetAlertRuleQuery,
  useGetRecordingRuleQuery,
  useGetRuleSequenceQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Drawer, Icon, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { grafanaRulesNav } from '../../utils/navigation';
import { useFolderPath } from '../folder-browsing/folderLookups';
import { RuleRecordedMetric } from '../recording-rules/RuleRecordedMetric';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleLabels } from '../rule-row/RuleLabels';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { InlineRequestError } from '../shared/InlineRequestError';
import { type RuleKind } from '../shared/ruleKind';

interface OpenedRuleSequence {
  sequenceUid: string;
  /** The rule the drawer was opened from; its step is marked. */
  ruleKind: RuleKind;
  ruleUid: string;
}

const OpenRuleSequenceContext = createContext<((opened: OpenedRuleSequence) => void) | undefined>(undefined);

/** Holds the page's single sequence drawer, so only one is ever open. */
export function RuleSequenceDrawerProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState<OpenedRuleSequence>();

  return (
    <OpenRuleSequenceContext.Provider value={setOpened}>
      {children}
      {opened && <RuleSequenceDrawer {...opened} onClose={() => setOpened(undefined)} />}
    </OpenRuleSequenceContext.Provider>
  );
}

export function useOpenRuleSequence() {
  const openRuleSequence = useContext(OpenRuleSequenceContext);
  if (!openRuleSequence) {
    throw new Error('useOpenRuleSequence must be used inside a RuleSequenceDrawerProvider');
  }
  return openRuleSequence;
}

type RuleSequenceDrawerProps = OpenedRuleSequence & { onClose: () => void };

function RuleSequenceDrawer({ onClose, ...opened }: RuleSequenceDrawerProps) {
  const { currentData: sequence } = useGetRuleSequenceQuery({ name: opened.sequenceUid });
  // Every member sits in the sequence's folder, so the folder is shown once here.
  const folderPath = useFolderPath(sequence?.metadata.annotations?.[AnnoKeyFolder]);

  const subtitle = sequence && (
    <Stack direction="row" alignItems="center" gap={1} wrap>
      <Text color="secondary">
        {t('alerting.gma-rule-list.sequence-drawer.interval', 'Evaluated every {{interval}}', {
          interpolation: { escapeValue: false },
          interval: sequence.spec.trigger.interval,
        })}
      </Text>
      {folderPath && folderPath.length > 0 && <FolderPath segments={folderPath} />}
    </Stack>
  );

  return (
    <Drawer
      title={t('alerting.gma-rule-list.sequence-drawer.title', 'Rule sequence')}
      subtitle={subtitle}
      size="md"
      onClose={onClose}
    >
      <RuleSequenceDrawerContent {...opened} />
    </Drawer>
  );
}

function RuleSequenceDrawerContent({ sequenceUid, ruleKind, ruleUid }: OpenedRuleSequence) {
  const { currentData: sequence, isLoading, isError, error, refetch } = useGetRuleSequenceQuery({ name: sequenceUid });

  if (isLoading) {
    return <RuleListSkeleton />;
  }
  if (isError) {
    return (
      <InlineRequestError
        title={t('alerting.gma-rule-list.sequence-drawer.error', 'Failed to load the rule sequence')}
        error={error}
        onRetry={refetch}
      />
    );
  }
  if (!sequence) {
    return null;
  }

  const recordingRules = sequence.spec.recordingRules;
  const alertRules = sequence.spec.alertingRules ?? [];
  const current = { kind: ruleKind, uid: ruleUid };

  return (
    <Stack direction="column" gap={2}>
      <SequenceStage
        title={t('alerting.gma-rule-list.sequence-drawer.recording-rules', 'Recording rules')}
        kind="recording"
        refs={recordingRules}
        firstStep={1}
        current={current}
      />
      <SequenceStage
        title={t('alerting.gma-rule-list.sequence-drawer.alert-rules', 'Alert rules')}
        kind="alert"
        refs={alertRules}
        firstStep={recordingRules.length + 1}
        current={current}
      />
    </Stack>
  );
}

interface SequenceStageProps {
  title: string;
  kind: RuleKind;
  refs: RuleSequenceRuleRef[];
  firstStep: number;
  current: { kind: RuleKind; uid: string };
}

/** One kind's rules under a heading, numbered on from the previous stage. */
function SequenceStage({ title, kind, refs, firstStep, current }: SequenceStageProps) {
  const styles = useStyles2(getStyles);
  const headingId = useId();

  if (refs.length === 0) {
    return null;
  }
  return (
    <Stack direction="column" gap={1}>
      <Text id={headingId} variant="bodySmall" color="secondary">
        {title}
      </Text>
      <ol className={styles.steps} aria-labelledby={headingId}>
        {refs.map(({ name }, index) => (
          <RuleStep
            key={name}
            kind={kind}
            uid={name}
            step={firstStep + index}
            isCurrent={kind === current.kind && name === current.uid}
          />
        ))}
      </ol>
    </Stack>
  );
}

interface RuleStepProps {
  kind: RuleKind;
  uid: string;
  step: number;
  isCurrent: boolean;
}

/** Loads one member rule; only the query for its kind runs. */
function RuleStep({ kind, uid, step, isCurrent }: RuleStepProps) {
  const titleId = useId();
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
      aria-labelledby={titleId}
      title={
        <TextLink id={titleId} href={grafanaRulesNav.viewLink(uid)} color="primary" inline={false}>
          {rule.spec.title}
        </TextLink>
      }
    >
      <StepProblem paused={rule.spec.paused} health={rule.status?.health} />
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
  /** The step's details, shown in one wrapping row under the title. */
  children: ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-busy'?: boolean;
}

/** A numbered point on the sequence line, with the rule's title and details. */
function SequenceStep({ step, isCurrent, title, children, ...ariaAttributes }: SequenceStepProps) {
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.step} aria-current={isCurrent || undefined} {...ariaAttributes}>
      <span className={cx(styles.number, isCurrent && styles.currentNumber)} aria-hidden>
        {step}
      </span>
      <Stack direction="column" gap={0.5} minWidth={0}>
        <Stack direction="row" alignItems="center" gap={1}>
          {title}
          {isCurrent && (
            <Badge color="blue" text={t('alerting.gma-rule-list.sequence-drawer.this-rule', 'This rule')} />
          )}
        </Stack>
        <Stack direction="row" alignItems="center" gap={1.5} wrap>
          {children}
        </Stack>
      </Stack>
    </li>
  );
}

/** Says why a step may not run or produce data; a healthy step shows nothing. */
function StepProblem({ paused, health }: { paused?: boolean; health?: string }) {
  if (paused) {
    return (
      <Text variant="bodySmall" color="warning">
        <Icon name="pause" size="xs" /> {t('alerting.gma-rule-list.status.paused', 'Paused')}
      </Text>
    );
  }
  if (health === 'Error') {
    return (
      <Text variant="bodySmall" color="error">
        <Icon name="times-circle" size="xs" /> {t('alerting.gma-rule-list.status.error', 'Failed to evaluate rule')}
      </Text>
    );
  }
  if (health === 'NoData') {
    return (
      <Text variant="bodySmall" color="warning">
        <Icon name="exclamation-triangle" size="xs" /> {t('alerting.gma-rule-list.status.no-data', 'Insufficient data')}
      </Text>
    );
  }
  return null;
}

const getStyles = (theme: GrafanaTheme2) => {
  const numberSize = theme.spacing(3.5);

  return {
    steps: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    step: css({
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: `${numberSize} minmax(0, 1fr)`,
      columnGap: theme.spacing(1.5),
      // The line from this step's number down to the next one.
      '&:not(:last-child)::before': {
        content: '""',
        position: 'absolute',
        left: `calc(${numberSize} / 2)`,
        top: numberSize,
        bottom: `calc(-1 * ${theme.spacing(2)})`,
        borderLeft: `1px solid ${theme.colors.border.medium}`,
      },
    }),
    number: css({
      width: numberSize,
      height: numberSize,
      borderRadius: theme.shape.radius.circle,
      border: `1px solid ${theme.colors.border.medium}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    currentNumber: css({
      borderColor: theme.colors.primary.main,
      color: theme.colors.primary.text,
    }),
  };
};
