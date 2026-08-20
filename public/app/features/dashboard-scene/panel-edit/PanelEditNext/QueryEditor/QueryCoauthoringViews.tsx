import { type ChangeEvent, type KeyboardEvent } from 'react';

import { type QueryEditorCoauthoringChangeV1, type QueryEditorCoauthoringContextV1 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Icon, IconButton, Spinner, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';

import { getQueryCoauthoringStyles } from './QueryCoauthoring.styles';
import { type QueryCoauthoringFeedbackState } from './QueryCoauthoringFeedback';
import { workingContextSummary, workingFocusSummary } from './queryCoauthoringPrompts';

interface PromptInputProps {
  value: string;
  placeholder: string;
  ariaLabel: string;
  actionLabel: string;
  disabled: boolean;
  isGenerating?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
}

export function QueryCoauthoringPromptInput({
  value,
  placeholder,
  ariaLabel,
  actionLabel,
  disabled,
  isGenerating = false,
  onChange,
  onSubmit,
  onStop,
}: PromptInputProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.currentTarget.value);
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={styles.promptRow}>
      <TextArea
        className={styles.promptInput}
        value={value}
        rows={1}
        autoFocus
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <IconButton
        className={styles.promptSubmit}
        name={isGenerating ? 'square-shape' : 'enter'}
        variant="secondary"
        aria-label={isGenerating ? t('query-editor-coauthoring.stop', 'Stop') : actionLabel}
        disabled={!isGenerating && disabled}
        onClick={isGenerating ? () => onStop?.() : onSubmit}
      />
    </div>
  );
}

export function QueryCoauthoringWorking({ context }: { context?: QueryEditorCoauthoringContextV1 }) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.building}>
      <div className={styles.status}>
        <Spinner size="sm" />
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="query-editor-coauthoring.building">Building query…</Trans>
        </Text>
      </div>
      {context && (
        <div className={styles.workingFlow}>
          <div className={styles.workingStep} aria-label={t('query-editor-coauthoring.working-focus', 'Query focus')}>
            <Text variant="bodySmall" color="secondary" weight="medium">
              <Trans i18nKey="query-editor-coauthoring.focus">FOCUS</Trans>
            </Text>
            <code>{workingFocusSummary(context)}</code>
          </div>
          <Icon name="arrow-right" />
          <div
            className={styles.workingStep}
            aria-label={t('query-editor-coauthoring.relevant-context', 'Relevant query context')}
          >
            <Text variant="bodySmall" color="secondary" weight="medium">
              <Trans i18nKey="query-editor-coauthoring.context">CONTEXT</Trans>
            </Text>
            <code>{workingContextSummary(context)}</code>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClarificationProps {
  message: string;
  intent: string;
  onIntentChange: (value: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
}

export function QueryCoauthoringClarification({
  message,
  intent,
  onIntentChange,
  onSubmit,
  onDismiss,
}: ClarificationProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.clarification}>
      <Text variant="bodySmall" weight="medium">
        <Trans i18nKey="query-editor-coauthoring.clarification-title">Assistant needs one detail</Trans>
      </Text>
      <div
        className={styles.clarificationMessage}
        role="region"
        aria-label={t('query-editor-coauthoring.clarification-message', 'Clarification message')}
      >
        <Text variant="bodySmall">{message}</Text>
      </div>
      <QueryCoauthoringPromptInput
        value={intent}
        placeholder={t('query-editor-coauthoring.clarification-placeholder', 'Add a detail...')}
        ariaLabel={t('query-editor-coauthoring.clarification-label', 'Add a detail')}
        actionLabel={t('query-editor-coauthoring.continue', 'Continue')}
        disabled={!intent.trim()}
        onChange={onIntentChange}
        onSubmit={onSubmit}
      />
      <Stack justifyContent="flex-start">
        <Button size="sm" variant="secondary" onClick={onDismiss}>
          <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
        </Button>
      </Stack>
    </div>
  );
}

interface FallbackProps {
  reason: string;
  onFeedback: (feedback: QueryCoauthoringFeedbackState) => void;
  onDismiss: () => void;
  onContinue: (reason: string) => void;
}

export function QueryCoauthoringFallback({ reason, onFeedback, onDismiss, onContinue }: FallbackProps) {
  return (
    <Stack direction="column" gap={1}>
      <Text variant="bodySmall">
        <Trans i18nKey="query-editor-coauthoring.handoff-guidance">
          This change may need to span other data sources or queries outside the one in focus. Continue in Assistant to
          make larger changes.
        </Trans>
      </Text>
      <Text variant="bodySmall" color="secondary" italic>
        <Trans i18nKey="query-editor-coauthoring.unsaved-safe">Your unsaved panel edits will not be lost.</Trans>
      </Text>
      <Stack gap={1} justifyContent="space-between">
        <FeedbackButtons outcome="handoff" onFeedback={onFeedback} />
        <Stack gap={1}>
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
          </Button>
          <Button size="sm" icon="ai-sparkle" onClick={() => onContinue(reason)}>
            <Trans i18nKey="query-editor-coauthoring.continue-assistant">Continue with Assistant</Trans>
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

interface ProposalProps {
  why: string[];
  changes: QueryEditorCoauthoringChangeV1[];
  onFeedback: (feedback: QueryCoauthoringFeedbackState) => void;
  onDismiss: () => void;
  onContinue: () => void;
  onAccept: () => void;
}

export function QueryCoauthoringProposal({ why, changes, onFeedback, onDismiss, onContinue, onAccept }: ProposalProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.proposal}>
      <div className={styles.proposalBody}>
        <Text variant="bodySmall" weight="medium">
          <Trans i18nKey="query-editor-coauthoring.why">Why</Trans>
        </Text>
        <Stack direction="column" gap={0.5}>
          {why.map((reason, index) => (
            <Text variant="bodySmall" key={index}>
              {reason}
            </Text>
          ))}
        </Stack>
        {changes.length > 0 && (
          <div className={styles.changes}>
            {changes.slice(0, 4).map((change) => (
              <div className={styles.changePair} key={change.id}>
                <div className={styles.change}>
                  <Text variant="bodySmall" color="secondary">
                    {(change.kind ?? 'change').toUpperCase()}
                  </Text>
                  <code>{change.original || 'added'}</code>
                </div>
                <Icon name="arrow-right" />
                <div className={`${styles.change} ${styles.proposedChange}`}>
                  <Text variant="bodySmall" color="secondary">
                    {(change.kind ?? 'change').toUpperCase()}
                  </Text>
                  <code>{change.proposed || 'removed'}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Stack gap={1} justifyContent="space-between">
        <Stack gap={0.5}>
          <FeedbackButtons outcome="proposal" onFeedback={onFeedback} />
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
          </Button>
        </Stack>
        <Stack gap={1}>
          <Button size="sm" variant="secondary" icon="ai-sparkle" onClick={onContinue}>
            <Trans i18nKey="query-editor-coauthoring.continue-in-assistant">Continue in Assistant</Trans>
          </Button>
          <Button size="sm" icon="check" onClick={onAccept}>
            <Trans i18nKey="query-editor-coauthoring.accept">Accept</Trans>
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}

function FeedbackButtons({
  outcome,
  onFeedback,
}: {
  outcome: QueryCoauthoringFeedbackState['outcome'];
  onFeedback: (feedback: QueryCoauthoringFeedbackState) => void;
}) {
  return (
    <>
      <IconButton
        name="thumbs-up"
        size="sm"
        variant="secondary"
        tooltip={t('query-editor-coauthoring.feedback-helpful', 'Helpful')}
        aria-label={t('query-editor-coauthoring.feedback-helpful', 'Helpful')}
        onClick={() => onFeedback({ outcome, rating: 1 })}
      />
      <IconButton
        name="thumbs-down"
        size="sm"
        variant="secondary"
        tooltip={t('query-editor-coauthoring.feedback-not-helpful', 'Not helpful')}
        aria-label={t('query-editor-coauthoring.feedback-not-helpful', 'Not helpful')}
        onClick={() => onFeedback({ outcome, rating: -1 })}
      />
    </>
  );
}
