import { cx } from '@emotion/css';
import { type ChangeEvent, type KeyboardEvent, type MutableRefObject, type ReactNode, useEffect, useRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Badge, Button, Icon, IconButton, Text, TextArea, useStyles2 } from '@grafana/ui';

import { getQueryCoauthoringStyles } from './QueryCoauthoring.styles';
import { type QueryCoauthoringFeedbackState } from './QueryCoauthoringFeedback';
import {
  type QueryEditorCoauthoringChangeV1,
  type QueryEditorCoauthoringContextV1,
} from './internalCoauthoringContract';
import { workingContextSummary, workingFocusSummary } from './queryCoauthoringPrompts';

interface HeaderProps {
  children?: ReactNode;
  onClose?: () => void;
  onStop?: () => void;
  pulse?: boolean;
}

export function QueryCoauthoringHeader({ children, onClose, onStop, pulse = false }: HeaderProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.header}>
      <div className={cx(styles.headerContent, pulse && styles.pulsingStatus)}>{children}</div>
      {onStop ? (
        <IconButton
          className={styles.close}
          name="square-shape"
          size="sm"
          tooltip={t('query-editor-coauthoring.stop', 'Stop')}
          aria-label={t('query-editor-coauthoring.stop', 'Stop')}
          onClick={onStop}
        />
      ) : onClose ? (
        <IconButton
          className={styles.close}
          name="times"
          size="sm"
          tooltip={t('query-editor-coauthoring.close', 'Close coauthoring')}
          aria-label={t('query-editor-coauthoring.close', 'Close coauthoring')}
          onClick={onClose}
        />
      ) : null}
    </div>
  );
}

export function QueryCoauthoringLiveStatus({ children }: { children: ReactNode }) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.status} role="status" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}

interface PromptInputProps {
  focusTrigger?: string;
  userGestureRef?: MutableRefObject<boolean>;
  value: string;
  placeholder: string;
  ariaLabel: string;
  ariaDescribedBy?: string;
  actionLabel: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function QueryCoauthoringPromptInput({
  focusTrigger,
  userGestureRef,
  value,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  actionLabel,
  disabled,
  onChange,
  onSubmit,
}: PromptInputProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const localUserGestureRef = useRef(false);
  const hasOutsideUserGestureRef = userGestureRef ?? localUserGestureRef;

  useEffect(() => {
    const recordOutsideUserGesture = (event: Event) => {
      if (event.target !== inputRef.current || (event instanceof KeyboardEvent && event.key === 'Tab')) {
        hasOutsideUserGestureRef.current = true;
      }
    };

    document.addEventListener('pointerdown', recordOutsideUserGesture, true);
    document.addEventListener('keydown', recordOutsideUserGesture, true);
    return () => {
      document.removeEventListener('pointerdown', recordOutsideUserGesture, true);
      document.removeEventListener('keydown', recordOutsideUserGesture, true);
    };
  }, [hasOutsideUserGestureRef]);

  useEffect(() => {
    const activeElement = document.activeElement;
    let firstFocusFrame: number | undefined;
    let secondFocusFrame: number | undefined;
    let focusFrame: number | undefined;
    const cancelFocus = () => {
      if (firstFocusFrame !== undefined) {
        cancelAnimationFrame(firstFocusFrame);
        firstFocusFrame = undefined;
      }
      if (secondFocusFrame !== undefined) {
        cancelAnimationFrame(secondFocusFrame);
        secondFocusFrame = undefined;
      }
      if (focusFrame !== undefined) {
        cancelAnimationFrame(focusFrame);
        focusFrame = undefined;
      }
    };

    // Wait until Monaco has finished its two-frame surface placement before taking focus.
    firstFocusFrame = requestAnimationFrame(() => {
      firstFocusFrame = undefined;
      secondFocusFrame = requestAnimationFrame(() => {
        secondFocusFrame = undefined;
        focusFrame = requestAnimationFrame(() => {
          focusFrame = undefined;
          const input = inputRef.current;
          const currentActiveElement = document.activeElement;

          if (
            input &&
            !hasOutsideUserGestureRef.current &&
            (currentActiveElement === activeElement ||
              currentActiveElement === document.body ||
              currentActiveElement === input)
          ) {
            input.focus();
          }
        });
      });
    });

    return cancelFocus;
  }, [focusTrigger, hasOutsideUserGestureRef]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.currentTarget.value);
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!disabled) {
        onSubmit();
      }
    }
  };

  return (
    <div className={styles.promptRow}>
      <TextArea
        ref={inputRef}
        className={styles.promptInput}
        value={value}
        rows={1}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <IconButton
        className={styles.promptSubmit}
        name="enter"
        aria-label={actionLabel}
        disabled={disabled}
        onClick={onSubmit}
      />
    </div>
  );
}

export function QueryCoauthoringClarificationAction({ onContinue }: { onContinue: () => void }) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.clarificationAction}>
      <Button size="sm" fill="text" icon="ai-sparkle" onClick={onContinue}>
        <Trans i18nKey="query-editor-coauthoring.continue-in-assistant-chat">Continue in Assistant chat</Trans>
      </Button>
    </div>
  );
}

export function QueryCoauthoringWorking({
  context,
  onStop,
}: {
  context?: QueryEditorCoauthoringContextV1;
  onStop: () => void;
}) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.building}>
      <QueryCoauthoringHeader onStop={onStop} pulse>
        <QueryCoauthoringLiveStatus>
          <Icon name="ai-sparkle" size="sm" />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="query-editor-coauthoring.building">Building query...</Trans>
          </Text>
        </QueryCoauthoringLiveStatus>
      </QueryCoauthoringHeader>
      {context && (
        <div className={styles.workingFlow}>
          <div className={styles.workingStep} aria-label={t('query-editor-coauthoring.working-focus', 'Query focus')}>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="query-editor-coauthoring.focus">FOCUS</Trans>
            </Text>
            <code>{workingFocusSummary(context)}</code>
          </div>
          <Icon className={styles.flowArrow} name="arrow-right" />
          <div
            className={cx(styles.workingStep, styles.workingStepDelayed)}
            aria-label={t('query-editor-coauthoring.relevant-context', 'Relevant query context')}
          >
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="query-editor-coauthoring.context">CONTEXT</Trans>
            </Text>
            <code>{workingContextSummary(context)}</code>
          </div>
        </div>
      )}
    </div>
  );
}

interface FallbackProps {
  reason: string;
  onClose: () => void;
  onFeedback: (feedback: QueryCoauthoringFeedbackState) => void;
  onContinue: (reason: string) => void;
}

export function QueryCoauthoringFallback({ reason, onClose, onFeedback, onContinue }: FallbackProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <>
      <QueryCoauthoringHeader onClose={onClose} />
      <div className={styles.handoff}>
        <Text variant="body">
          <Trans i18nKey="query-editor-coauthoring.handoff-guidance">
            Your changes may need to span another datasource or additional queries outside the one we are focused on.
            Continue in Assistant chat to make larger changes.
          </Trans>
        </Text>
        <Text variant="body" color="secondary" italic>
          <Trans i18nKey="query-editor-coauthoring.unsaved-safe">Any unsaved panel edits will not be lost.</Trans>
        </Text>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerActions}>
          <FeedbackButtons outcome="handoff" onFeedback={onFeedback} />
        </div>
        <Button size="sm" fill="text" icon="ai-sparkle" onClick={() => onContinue(reason)}>
          <Trans i18nKey="query-editor-coauthoring.continue-in-assistant-chat">Continue in Assistant chat</Trans>
        </Button>
      </div>
    </>
  );
}

interface ProposalProps {
  why: string[];
  changes: QueryEditorCoauthoringChangeV1[];
  isPreviewRunning: boolean;
  onFeedback: (feedback: QueryCoauthoringFeedbackState) => void;
  onClose: () => void;
  onContinue: () => void;
  onAccept: () => void;
}

export function QueryCoauthoringProposal({
  why,
  changes,
  isPreviewRunning,
  onFeedback,
  onClose,
  onContinue,
  onAccept,
}: ProposalProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.proposal}>
      <QueryCoauthoringHeader onClose={onClose} pulse={isPreviewRunning}>
        <QueryCoauthoringLiveStatus>
          {isPreviewRunning ? (
            <>
              <Icon name="ai-sparkle" size="sm" />
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="query-editor-coauthoring.running-updated-query">Running updated query...</Trans>
              </Text>
            </>
          ) : (
            <Badge color="blue" text={t('query-editor-coauthoring.previewing-query', 'Previewing query')} />
          )}
        </QueryCoauthoringLiveStatus>
      </QueryCoauthoringHeader>
      <div
        className={styles.scrollBody}
        data-testid={selectors.components.QueryEditorCoauthoring.container}
        role="region"
        aria-label={t('query-editor-coauthoring.proposal-details', 'Query proposal details')}
      >
        <div className={styles.proposalBody}>
          <Text variant="body" color="secondary">
            <Trans i18nKey="query-editor-coauthoring.suggestion-updated">Suggestion updated</Trans>
          </Text>
          {why.map((reason, index) => (
            <Text variant="body" key={index}>
              {reason}
            </Text>
          ))}
        </div>
        {changes.length > 0 && (
          <div className={styles.changes}>
            {changes.slice(0, 4).map((change) => (
              <div className={styles.changePair} key={change.id}>
                <div
                  className={styles.change}
                  aria-label={t('query-editor-coauthoring.original-change', 'Original {{kind}}', {
                    kind: change.kind ?? 'change',
                  })}
                >
                  <Text variant="bodySmall" color="secondary">
                    {(change.kind ?? 'change').toUpperCase()}
                  </Text>
                  <code>{change.original || 'added'}</code>
                </div>
                <Icon className={styles.flowArrow} name="arrow-right" />
                <div
                  className={cx(styles.change, styles.proposedChange)}
                  aria-label={t('query-editor-coauthoring.proposed-change', 'Proposed {{kind}}', {
                    kind: change.kind ?? 'change',
                  })}
                >
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
      <div className={styles.footer}>
        <div className={styles.footerActions}>
          <FeedbackButtons outcome="proposal" onFeedback={onFeedback} />
        </div>
        <div className={styles.footerActions}>
          <Button className={styles.compactButton} size="sm" fill="text" icon="ai-sparkle" onClick={onContinue}>
            <Trans i18nKey="query-editor-coauthoring.open-in-chat">Open in chat</Trans>
          </Button>
          <Button className={styles.compactButton} size="sm" icon="check" onClick={onAccept}>
            <Trans i18nKey="query-editor-coauthoring.accept">Accept</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function QueryCoauthoringIterationNudge({
  onContinueHere,
  onContinueInAssistant,
}: {
  onContinueHere: () => void;
  onContinueInAssistant: () => void;
}) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={styles.iteration}>
      <div className={styles.iterationCopy}>
        <Text variant="body" color="secondary">
          <Trans i18nKey="query-editor-coauthoring.iteration-nudge">
            Working on something big? Iterate on larger changes with more space.
          </Trans>
        </Text>
      </div>
      <div className={styles.footer}>
        <span />
        <div className={styles.footerActions}>
          <Button size="sm" fill="text" variant="secondary" onClick={onContinueHere}>
            <Trans i18nKey="query-editor-coauthoring.continue-here">Continue here</Trans>
          </Button>
          <Button size="sm" fill="text" icon="ai-sparkle" onClick={onContinueInAssistant}>
            <Trans i18nKey="query-editor-coauthoring.continue-in-assistant">Continue in Assistant</Trans>
          </Button>
        </div>
      </div>
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
        tooltip={t('query-editor-coauthoring.feedback-helpful', 'Helpful')}
        aria-label={t('query-editor-coauthoring.feedback-helpful', 'Helpful')}
        onClick={() => onFeedback({ outcome, rating: 1 })}
      />
      <IconButton
        name="thumbs-down"
        size="sm"
        tooltip={t('query-editor-coauthoring.feedback-not-helpful', 'Not helpful')}
        aria-label={t('query-editor-coauthoring.feedback-not-helpful', 'Not helpful')}
        onClick={() => onFeedback({ outcome, rating: -1 })}
      />
    </>
  );
}
