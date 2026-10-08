import { cx } from '@emotion/css';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Alert, Badge, Button, Icon, IconButton, Portal, Text, TextArea, Tooltip, useStyles2 } from '@grafana/ui';

import { getQueryCoauthoringStyles } from './QueryCoauthoring.styles';
import { type QueryCoauthoringFeedbackState } from './QueryCoauthoringFeedback';
import { type QueryEditorCoauthoringContextV1 } from './internalCoauthoringContract';
import { type QueryCoauthoringDiffHunk } from './queryCoauthoringDiff';
import { type QueryCoauthoringMentionMenu } from './queryCoauthoringMentions';
import { type QueryPreviewOutcome } from './queryCoauthoringPreviewOutcome';
import { type QueryExplanation, workingContextSummary, workingFocusSummary } from './queryCoauthoringPrompts';
import { useQueryCoauthoringChipPeek } from './useQueryCoauthoringChipPeek';

interface HeaderProps {
  className?: string;
  children?: ReactNode;
  onClose?: () => void;
  onStop?: () => void;
  pulse?: boolean;
}

export function QueryCoauthoringHeader({ className, children, onClose, onStop, pulse = false }: HeaderProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <div className={cx(styles.header, className)}>
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
  onChange: (value: string, caret?: number) => void;
  onSubmit: () => void;
  mention?: QueryCoauthoringMentionMenu;
  mentionMenuRef?: MutableRefObject<HTMLDivElement | null>;
  cursorPosition?: number;
  onCaretChange?: (caret: number) => void;
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
  mention,
  mentionMenuRef,
  cursorPosition,
  onCaretChange,
}: PromptInputProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const initialActiveElementRef = useRef(document.activeElement);
  const localUserGestureRef = useRef(false);
  const hasOutsideUserGestureRef = userGestureRef ?? localUserGestureRef;
  const menuId = useId();
  const { refs, floatingStyles } = useFloating({
    open: !!mention,
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  useLayoutEffect(() => {
    if (cursorPosition !== undefined) {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(cursorPosition, cursorPosition);
    }
  }, [cursorPosition, value]);

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
    let retryFocusFrame: number | undefined;
    const focusPrompt = () => {
      const input = inputRef.current;
      const currentActiveElement = document.activeElement;
      if (
        input &&
        !hasOutsideUserGestureRef.current &&
        (currentActiveElement === activeElement ||
          currentActiveElement === initialActiveElementRef.current ||
          currentActiveElement === document.body ||
          currentActiveElement === input)
      ) {
        input.focus();
      }
    };
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
      if (retryFocusFrame !== undefined) {
        cancelAnimationFrame(retryFocusFrame);
        retryFocusFrame = undefined;
      }
    };

    // Wait until Monaco has finished its two-frame surface placement before taking focus.
    firstFocusFrame = requestAnimationFrame(() => {
      firstFocusFrame = undefined;
      secondFocusFrame = requestAnimationFrame(() => {
        secondFocusFrame = undefined;
        focusFrame = requestAnimationFrame(() => {
          focusFrame = undefined;
          focusPrompt();
          // Monaco can reclaim focus after placement; retry once while respecting user navigation.
          retryFocusFrame = requestAnimationFrame(() => {
            retryFocusFrame = undefined;
            focusPrompt();
          });
        });
      });
    });

    return cancelFocus;
  }, [focusTrigger, hasOutsideUserGestureRef]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    onChange(event.currentTarget.value, event.currentTarget.selectionStart);
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (mention && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      mention.move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (mention) {
        mention.select();
      } else if (!disabled) {
        onSubmit();
      }
    }
  };

  return (
    <>
      <div className={styles.promptRow}>
        <TextArea
          ref={(element) => {
            inputRef.current = element;
            refs.setReference(element);
          }}
          className={styles.promptInput}
          value={value}
          rows={1}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-autocomplete={mention ? 'list' : undefined}
          aria-expanded={!!mention}
          aria-haspopup="listbox"
          aria-controls={mention ? menuId : undefined}
          aria-activedescendant={mention ? `${menuId}-${mention.selectedIndex}` : undefined}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={(event) => onCaretChange?.(event.currentTarget.selectionStart)}
        />
        <IconButton
          className={styles.promptSubmit}
          name="enter"
          aria-label={actionLabel}
          disabled={disabled}
          onClick={onSubmit}
        />
      </div>
      {mention && (
        <Portal>
          <div
            id={menuId}
            ref={(element) => {
              refs.setFloating(element);
              if (mentionMenuRef) {
                mentionMenuRef.current = element;
              }
            }}
            role="listbox"
            aria-label={t('query-editor-coauthoring.mention-suggestions', 'Metrics and labels')}
            className={styles.mentionMenu}
            style={floatingStyles}
          >
            {mention.options.map((option, index) => (
              <button
                key={`${option.kind}:${option.name}`}
                type="button"
                role="option"
                id={`${menuId}-${index}`}
                tabIndex={-1}
                aria-selected={index === mention.selectedIndex}
                aria-label={t('query-editor-coauthoring.mention-option', '{{name}} ({{kind}})', {
                  name: option.name,
                  kind:
                    option.kind === 'metric'
                      ? t('query-editor-coauthoring.mention-metric', 'Metric')
                      : t('query-editor-coauthoring.mention-label', 'Label'),
                })}
                className={cx(styles.mentionOption, index === mention.selectedIndex && styles.mentionSelected)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => mention.select(index)}
              >
                <Icon name={option.kind === 'metric' ? 'graph-bar' : 'tag-alt'} size="sm" />
                {option.name}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </>
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

export function QueryCoauthoringExplain({
  answer,
  intent,
  onIntentChange,
  onFollowUp,
  onModify,
  onClose,
  mention,
  mentionMenuRef,
  cursorPosition,
  onCaretChange,
}: {
  answer: QueryExplanation;
  intent: string;
  onIntentChange: (intent: string, caret?: number) => void;
  onFollowUp: (question?: string) => void;
  onModify: () => void;
  onClose: () => void;
  mention?: QueryCoauthoringMentionMenu;
  mentionMenuRef?: MutableRefObject<HTMLDivElement | null>;
  cursorPosition?: number;
  onCaretChange?: (caret: number) => void;
}) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <>
      <QueryCoauthoringHeader onClose={onClose}>
        <Text variant="body" color="secondary">
          <Trans i18nKey="query-editor-coauthoring.highlighted-query">Highlighted query</Trans>
        </Text>
      </QueryCoauthoringHeader>
      <div className={styles.body}>
        <Text variant="body">{answer.explanation}</Text>
        <div className={styles.quickActions}>
          {answer.followUps.map((question, index) => (
            <Button key={index} size="sm" variant="secondary" onClick={() => onFollowUp(question)}>
              {question}
            </Button>
          ))}
        </div>
      </div>
      <QueryCoauthoringPromptInput
        value={intent}
        placeholder={t('query-editor-coauthoring.follow-up-placeholder', 'Ask a follow up…')}
        ariaLabel={t('query-editor-coauthoring.follow-up-label', 'Ask a follow up')}
        actionLabel={t('query-editor-coauthoring.submit-follow-up', 'Ask')}
        disabled={!intent.trim()}
        onChange={onIntentChange}
        onSubmit={() => onFollowUp()}
        mention={mention}
        mentionMenuRef={mentionMenuRef}
        cursorPosition={cursorPosition}
        onCaretChange={onCaretChange}
      />
      <div className={styles.footer}>
        <Button size="sm" variant="secondary" fill="text" onClick={onModify}>
          <Trans i18nKey="query-editor-coauthoring.modify-query">Modify this query</Trans>
        </Button>
      </div>
    </>
  );
}

export function QueryCoauthoringWorking({
  context,
  mode,
  onStop,
}: {
  context?: QueryEditorCoauthoringContextV1;
  mode: 'modify' | 'explain';
  onStop: () => void;
}) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  return (
    <QueryCoauthoringHeader onStop={onStop}>
      <QueryCoauthoringLiveStatus>
        <div className={styles.workingStatus}>
          <Text variant="bodySmall" color="secondary">
            {mode === 'explain' ? (
              <Trans i18nKey="query-editor-coauthoring.explaining">Explaining query…</Trans>
            ) : (
              <Trans i18nKey="query-editor-coauthoring.building">Building query…</Trans>
            )}
          </Text>
          {context && (
            <div className={styles.workingChips}>
              <div
                className={styles.workingChip}
                aria-label={t('query-editor-coauthoring.working-focus', 'Query focus')}
              >
                <Text variant="bodySmall" color="secondary">
                  <Trans i18nKey="query-editor-coauthoring.focus">Focus</Trans>
                </Text>
                <code>{workingFocusSummary(context)}</code>
              </div>
              <span className={styles.workingSweep} aria-hidden="true" />
              <div
                className={styles.workingChip}
                aria-label={t('query-editor-coauthoring.relevant-context', 'Relevant query context')}
              >
                <code>{workingContextSummary(context)}</code>
              </div>
            </div>
          )}
        </div>
      </QueryCoauthoringLiveStatus>
    </QueryCoauthoringHeader>
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
  width?: number;
  why: string[];
  baseline: string;
  diff: QueryCoauthoringDiffHunk[];
  unconfirmedValues?: string[];
  optionCount: number;
  selectedIndex: number;
  onSelect: (index: number, source?: 'keyboard') => void;
  onPeek?: (index: number) => void;
  onStopPeek?: () => void;
  isPreviewRunning: boolean;
  previewOutcome?: QueryPreviewOutcome;
  onFeedback: (feedback: QueryCoauthoringFeedbackState) => void;
  onClose: () => void;
  onContinue: () => void;
  onAccept: () => void;
}

export function QueryCoauthoringProposal({
  width,
  why,
  baseline,
  diff,
  unconfirmedValues,
  optionCount,
  selectedIndex,
  onSelect,
  onPeek,
  onStopPeek,
  isPreviewRunning,
  previewOutcome,
  onFeedback,
  onClose,
  onContinue,
  onAccept,
}: ProposalProps) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  const narrow = width !== undefined && width < 420;
  const tiny = width !== undefined && width < 280;
  const hasPreviewCallout =
    previewOutcome &&
    previewOutcome.kind !== 'loading' &&
    (previewOutcome.kind !== 'ok' || (!tiny && previewOutcome.notices.length > 0));
  const tablistRef = useRef<HTMLDivElement>(null);
  const focusSelected = useRef(false);
  useLayoutEffect(() => {
    if (focusSelected.current) {
      focusSelected.current = false;
      tablistRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    }
  }, [selectedIndex]);
  const chipPeek = useQueryCoauthoringChipPeek(onPeek, onStopPeek);
  const acceptButton = (
    <Button className={styles.compactButton} size="sm" icon="check" onClick={onAccept} disabled={selectedIndex < 0}>
      <Trans i18nKey="query-editor-coauthoring.accept">Accept</Trans>
    </Button>
  );
  return (
    <div className={styles.proposal}>
      <div
        className={cx(
          styles.explanationCard,
          narrow && styles.narrowExplanationCard,
          tiny && styles.tinyExplanationCard
        )}
      >
        <div
          ref={tablistRef}
          role="tablist"
          tabIndex={-1}
          aria-label={t('query-editor-coauthoring.options', 'Query options')}
          className={cx(styles.optionTabs, narrow && styles.narrowOptionTabs, tiny && styles.tinyOptionTabs)}
          onKeyDown={(event) => {
            let next: number;
            switch (event.key) {
              case 'ArrowRight':
                next = selectedIndex === optionCount - 1 ? -1 : selectedIndex + 1;
                break;
              case 'ArrowLeft':
                next = selectedIndex === -1 ? optionCount - 1 : selectedIndex - 1;
                break;
              case 'Home':
                next = -1;
                break;
              case 'End':
                next = optionCount - 1;
                break;
              default:
                return;
            }
            event.preventDefault();
            focusSelected.current = true;
            onSelect(next, 'keyboard');
          }}
        >
          <Button
            className={tiny ? styles.compactOptionPill : undefined}
            size="sm"
            variant="secondary"
            icon="arrow-left"
            aria-label={t('query-editor-coauthoring.previous-option', 'Previous option')}
            style={tiny ? undefined : { display: 'none' }}
            onClick={() => onSelect(selectedIndex === -1 ? optionCount - 1 : selectedIndex - 1)}
          />
          {Array.from({ length: optionCount + 1 }, (_, rank) => (
            <Button
              key={rank}
              className={narrow ? styles.compactOptionPill : undefined}
              style={tiny && selectedIndex !== rank - 1 ? { display: 'none' } : undefined}
              size="sm"
              variant="secondary"
              role="tab"
              data-option-index={rank - 1}
              aria-selected={selectedIndex === rank - 1}
              tabIndex={selectedIndex === rank - 1 ? 0 : -1}
              onPointerDown={(event) => chipPeek.start(event, rank - 1)}
              onLostPointerCapture={chipPeek.stop}
              onClick={(event) => {
                if (!chipPeek.consumeClick(event)) {
                  onSelect(rank - 1);
                }
              }}
            >
              {rank === 0
                ? t('query-editor-coauthoring.original', 'Original')
                : t('query-editor-coauthoring.option', 'Option {{rank}}', { rank })}
            </Button>
          ))}
          <Button
            className={tiny ? styles.compactOptionPill : undefined}
            size="sm"
            variant="secondary"
            icon="arrow-right"
            aria-label={t('query-editor-coauthoring.next-option', 'Next option')}
            style={tiny ? undefined : { display: 'none' }}
            onClick={() => onSelect(selectedIndex === optionCount - 1 ? -1 : selectedIndex + 1)}
          />
        </div>
        <QueryCoauthoringHeader
          className={narrow ? styles.hidden : undefined}
          onClose={onClose}
          pulse={isPreviewRunning}
        >
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
          style={narrow && !hasPreviewCallout && !unconfirmedValues?.length ? { display: 'none' } : undefined}
          data-testid={selectors.components.QueryEditorCoauthoring.container}
          role="region"
          aria-label={t('query-editor-coauthoring.proposal-details', 'Query proposal details')}
        >
          <div className={cx(styles.proposalBody, narrow && styles.compactProposalBody)}>
            <Text variant="body" color="secondary" hidden={narrow}>
              {selectedIndex < 0
                ? t('query-editor-coauthoring.original-query', 'Original query')
                : t('query-editor-coauthoring.suggestion-updated', 'Suggestion updated')}
            </Text>
            <div style={narrow ? { display: 'none' } : undefined}>
              {diff.length > 0 && <QueryCoauthoringInlineDiff baseline={baseline} hunks={diff} />}
            </div>
            <div role="region" aria-label={t('query-editor-coauthoring.preview-result', 'Preview result')}>
              <QueryCoauthoringPreviewResult outcome={previewOutcome} tiny={tiny} />
            </div>
            <div style={narrow ? { display: 'none' } : undefined}>
              {why.map((reason, index) => (
                <Text variant="body" key={index}>
                  {reason}
                </Text>
              ))}
            </div>
            {unconfirmedValues?.map((value, index) => (
              <div key={index} className={styles.unconfirmedValue}>
                <Icon name="exclamation-triangle" size="sm" aria-hidden />{' '}
                <Text variant="bodySmall" color="secondary">
                  {t('query-editor-coauthoring.unconfirmed-prefix', 'Unconfirmed:')}
                </Text>{' '}
                <Text variant="body">{value}</Text>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={cx(styles.footer, styles.actionsCard, tiny && styles.tinyActionsCard)}>
        <div className={styles.footerActions} style={narrow ? { display: 'none' } : undefined}>
          <FeedbackButtons outcome="proposal" onFeedback={onFeedback} />
        </div>
        <div className={cx(styles.footerActions, tiny && styles.tinyActionsRow)}>
          <Button
            className={tiny ? styles.tinyIconAction : undefined}
            size="sm"
            fill="text"
            variant="secondary"
            onClick={onClose}
            icon={tiny ? 'times' : undefined}
            aria-label={t('query-editor-coauthoring.cancel', 'Cancel')}
          >
            <span className={tiny ? styles.hidden : undefined}>
              <Trans i18nKey="query-editor-coauthoring.cancel">Cancel</Trans>
            </span>
          </Button>
          <Button
            className={cx(styles.compactButton, tiny && styles.tinyIconAction)}
            size="sm"
            fill="text"
            icon="ai-sparkle"
            onClick={onContinue}
            aria-label={t('query-editor-coauthoring.open-in-chat', 'Open in Chat')}
          >
            <span className={tiny ? styles.hidden : undefined}>
              <Trans i18nKey="query-editor-coauthoring.open-in-chat">Open in Chat</Trans>
            </span>
          </Button>
          {selectedIndex < 0 ? (
            <Tooltip content={t('query-editor-coauthoring.select-to-accept', 'Select an option to accept')}>
              <span>{acceptButton}</span>
            </Tooltip>
          ) : (
            acceptButton
          )}
        </div>
      </div>
    </div>
  );
}

function QueryCoauthoringPreviewResult({ outcome, tiny }: { outcome?: QueryPreviewOutcome; tiny: boolean }) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  if (!outcome || outcome.kind === 'loading') {
    return null;
  }
  if (tiny) {
    if (outcome.kind === 'ok') {
      return null;
    }
    const title =
      outcome.kind === 'error'
        ? t('query-editor-coauthoring.preview-error-title', 'Preview error')
        : outcome.kind === 'no-data'
          ? t('query-editor-coauthoring.preview-no-data', 'No data')
          : t('query-editor-coauthoring.preview-no-signal-title', 'No signal');
    return (
      <div
        role={outcome.kind === 'no-signal' ? 'status' : 'alert'}
        data-kind={outcome.kind}
        className={styles.compactPreviewResult}
      >
        <Icon
          name={
            outcome.kind === 'error'
              ? 'exclamation-circle'
              : outcome.kind === 'no-data'
                ? 'exclamation-triangle'
                : 'info-circle'
          }
          size="sm"
          aria-hidden
        />
        <Text variant="bodySmall">{title}</Text>
      </div>
    );
  }
  if (outcome.kind === 'error') {
    return (
      <Alert
        severity="error"
        title={outcome.message ?? t('query-editor-coauthoring.preview-error', 'The query preview failed.')}
      />
    );
  }
  if (outcome.kind === 'no-data') {
    return (
      <Alert severity="warning" title={t('query-editor-coauthoring.preview-no-data', 'No data')}>
        <Trans i18nKey="query-editor-coauthoring.preview-no-data-suggestion">
          Try another option or widen the time range.
        </Trans>
      </Alert>
    );
  }
  const messages =
    outcome.kind === 'no-signal'
      ? [
          t(
            'query-editor-coauthoring.preview-no-signal',
            'Every value is 0. That can be correct (for example, no errors), so check it matches what you expect.'
          ),
        ]
      : outcome.notices;
  return messages.length > 0 ? (
    <div role="status">
      <Icon name="info-circle" size="sm" aria-hidden />{' '}
      {messages.map((message) => (
        <Text key={message} variant="bodySmall" color="secondary">
          {message}
        </Text>
      ))}
    </div>
  ) : null;
}

function QueryCoauthoringInlineDiff({ baseline, hunks }: { baseline: string; hunks: QueryCoauthoringDiffHunk[] }) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  let cursor = 0;
  const fragments = hunks.map((hunk, index) => {
    const unchanged = baseline.slice(cursor, hunk.from);
    cursor = hunk.to;
    const label =
      hunk.focus === 'outside'
        ? t('query-editor-coauthoring.change-outside-focus', 'Change outside Focus')
        : t('query-editor-coauthoring.change-inside-focus', 'Change inside Focus');
    return (
      <Fragment key={index}>
        {unchanged}
        <span
          role="group"
          aria-label={label}
          title={label}
          className={hunk.focus === 'outside' ? styles.outsideFocus : undefined}
        >
          {hunk.original && <del className={styles.diffRemoved}>{hunk.original}</del>}
          {hunk.proposed && <ins className={styles.diffAdded}>{hunk.proposed}</ins>}
        </span>
      </Fragment>
    );
  });
  return (
    <pre className={styles.inlineDiff} aria-label={t('query-editor-coauthoring.query-diff', 'Query diff')}>
      <code>
        {fragments}
        {baseline.slice(cursor)}
      </code>
    </pre>
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
