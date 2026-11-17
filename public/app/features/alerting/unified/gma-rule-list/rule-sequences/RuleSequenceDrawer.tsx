import { type ReactNode, createContext, useContext, useId, useState } from 'react';

import { type RuleSequenceRuleRef, useGetRuleSequenceQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Box, Drawer, Stack, Text } from '@grafana/ui';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { useFolderPath } from '../folder-browsing/folderLookups';
import { FolderPath } from '../rule-row/FolderPath';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { InlineRequestError } from '../shared/InlineRequestError';
import { type RuleKind } from '../shared/ruleKind';

import { RuleStep } from './RuleSequenceStep';

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

  const { recordingRules, alertingRules = [] } = sequence.spec;
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
        refs={alertingRules}
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
  const headingId = useId();

  if (refs.length === 0) {
    return null;
  }
  return (
    <Stack direction="column" gap={1}>
      <Text id={headingId} variant="bodySmall" color="secondary">
        {title}
      </Text>
      <Box element="ol" display="flex" direction="column" gap={1} margin={0} padding={0} aria-labelledby={headingId}>
        {refs.map(({ name }, index) => (
          <RuleStep
            key={name}
            kind={kind}
            uid={name}
            step={firstStep + index}
            isCurrent={kind === current.kind && name === current.uid}
          />
        ))}
      </Box>
    </Stack>
  );
}
