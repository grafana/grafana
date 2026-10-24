import { cx } from '@emotion/css';
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { getQueryCoauthoringStyles } from './QueryCoauthoring.styles';
import {
  QueryCoauthoringClarificationAction,
  QueryCoauthoringExplain,
  QueryCoauthoringFallback,
  QueryCoauthoringHeader,
  QueryCoauthoringIterationNudge,
  QueryCoauthoringPromptInput,
  QueryCoauthoringProposal,
  QueryCoauthoringWorking,
} from './QueryCoauthoringViews';
import { useQueryCoauthoringGroup } from './useQueryCoauthoringGroup';
import { useQueryCoauthoringSession, type QueryCoauthoringSessionOptions } from './useQueryCoauthoringSession';
import { useQueryCoauthoringViewport } from './useQueryCoauthoringViewport';

interface Props extends QueryCoauthoringSessionOptions {
  portalTarget: HTMLElement;
}

export function QueryCoauthoring({ portalTarget, ...sessionOptions }: Props) {
  const styles = useStyles2(getQueryCoauthoringStyles);
  const promptMessageId = useId();
  const availableHeight = useQueryCoauthoringViewport(portalTarget);
  const containerRef = useRef<HTMLDivElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement | null>(null);
  const session = useQueryCoauthoringSession(sessionOptions);
  const group = useQueryCoauthoringGroup({
    portalTarget,
    containerRef,
    isProposal: session.state.kind === 'proposal',
    layout: session.groupLayout,
    update: session.updateGroup,
  });
  const { dismissUntouched } = session;
  const focusState = session.state.kind;
  const previousFocusStateRef = useRef(focusState);

  useEffect(() => {
    const onOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target) &&
        !mentionMenuRef.current?.contains(event.target)
      ) {
        dismissUntouched();
      }
    };
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  }, [dismissUntouched]);

  useEffect(() => {
    const previousFocusState = previousFocusStateRef.current;
    previousFocusStateRef.current = focusState;
    if (focusState === previousFocusState || focusState === 'prompt') {
      return;
    }

    const activeElement = document.activeElement;
    let firstFocusFrame = requestAnimationFrame(() => {
      firstFocusFrame = 0;
      secondFocusFrame = requestAnimationFrame(() => {
        secondFocusFrame = 0;
        const container = containerRef.current;
        const currentActiveElement = document.activeElement;
        if (container && (currentActiveElement === activeElement || currentActiveElement === document.body)) {
          container.focus();
        }
      });
    });
    let secondFocusFrame = 0;

    return () => {
      if (firstFocusFrame) {
        cancelAnimationFrame(firstFocusFrame);
      }
      if (secondFocusFrame) {
        cancelAnimationFrame(secondFocusFrame);
      }
    };
  }, [focusState]);

  const onKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (session.mention) {
        session.closeMention();
      } else {
        session.dismissUntouched();
      }
    },
    [session]
  );

  const state = session.state;

  return createPortal(
    <div
      ref={containerRef}
      className={cx(
        styles.container,
        state.kind === 'proposal' && styles.proposalGroup,
        session.groupLayout && styles.frozenGroup,
        session.state.kind === 'proposal' && session.state.peekIndex !== undefined && styles.dimmed
      )}
      role="dialog"
      aria-label={t('query-editor-coauthoring.dialog', 'Query coauthor')}
      tabIndex={-1}
      onKeyDownCapture={onKeyDownCapture}
      onPointerDown={group.start}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) {
          group.freeze();
        }
      }}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'width') {
          group.freeze();
        }
      }}
      style={
        session.groupLayout
          ? {
              position: 'fixed',
              left: session.groupLayout.left,
              top: session.groupLayout.top,
              width: session.groupLayout.width,
              maxHeight: Math.max(window.innerHeight - session.groupLayout.top - 8, 0),
            }
          : {
              width: state.kind === 'proposal' ? group.restWidth : undefined,
              maxHeight: availableHeight,
            }
      }
    >
      {state.kind === 'proposal' && (
        <>
          <div className={styles.dragHandle} data-proposal-drag-handle aria-hidden>
            <Icon name="draggabledots" />
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('query-editor-coauthoring.resize-left', 'Resize proposal from left')}
            data-proposal-resize="left"
            className={cx(
              styles.resizeHandle,
              styles.resizeLeft,
              session.groupGesture?.kind === 'resize-left' && styles.resizeActive
            )}
          />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('query-editor-coauthoring.resize-right', 'Resize proposal from right')}
            data-proposal-resize="right"
            className={cx(
              styles.resizeHandle,
              styles.resizeRight,
              session.groupGesture?.kind === 'resize-right' && styles.resizeActive
            )}
          />
        </>
      )}
      {state.kind === 'assistant-loading' && (
        <QueryCoauthoringHeader onClose={session.dismiss} pulse>
          <Spinner size="sm" />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="query-editor-coauthoring.checking-assistant">Checking Assistant availability...</Trans>
          </Text>
        </QueryCoauthoringHeader>
      )}
      {state.kind === 'assistant-unavailable' && (
        <QueryCoauthoringHeader onClose={session.dismiss}>
          <Text variant="bodySmall" weight="medium">
            <Trans i18nKey="query-editor-coauthoring.assistant-unavailable">Assistant unavailable</Trans>
          </Text>
        </QueryCoauthoringHeader>
      )}
      {state.kind === 'prompt' && (
        <>
          {/* Escape and outside clicks keep an engaged session open, so it needs a visible close action. */}
          {!state.clarification && session.engaged && <QueryCoauthoringHeader onClose={session.dismiss} />}
          {state.clarification && (
            <>
              <QueryCoauthoringHeader className={styles.explanationHeader} onClose={session.dismiss}>
                <div className={styles.headerCopy}>
                  <Text variant="body" color="secondary">
                    <Trans i18nKey="query-editor-coauthoring.clarification-title">Detail requested</Trans>
                  </Text>
                  <div
                    data-testid={selectors.components.QueryEditorCoauthoring.container}
                    role="region"
                    aria-label={t('query-editor-coauthoring.clarification-message', 'Clarification message')}
                  >
                    <Text id={promptMessageId} variant="body">
                      {state.clarification.message}
                    </Text>
                  </div>
                </div>
              </QueryCoauthoringHeader>
            </>
          )}
          <QueryCoauthoringPromptInput
            key={state.clarification ? `clarification-${state.submittedModifyCount}` : 'initial'}
            focusTrigger={`${state.clarification ? `clarification-${state.submittedModifyCount}` : 'initial'}-${
              state.context ? 'ready' : 'reading'
            }`}
            userGestureRef={state.promptUserGestureRef}
            value={state.intent}
            placeholder={
              state.clarification
                ? t('query-editor-coauthoring.clarification-placeholder', 'Add extra detail…')
                : t('query-editor-coauthoring.prompt-placeholder', 'Describe a quick change…')
            }
            ariaLabel={
              state.clarification
                ? t('query-editor-coauthoring.clarification-label', 'Add extra detail')
                : t('query-editor-coauthoring.prompt-label', 'Describe a query change')
            }
            ariaDescribedBy={state.clarification ? promptMessageId : undefined}
            actionLabel={
              state.clarification
                ? t('query-editor-coauthoring.continue', 'Continue')
                : t('query-editor-coauthoring.submit', 'Coauthor')
            }
            disabled={!state.intent.trim() || !state.context}
            onChange={state.setIntent}
            onSubmit={state.submit}
            mention={session.mention}
            mentionMenuRef={mentionMenuRef}
            cursorPosition={session.cursorPosition}
            onCaretChange={session.setCaret}
          />
          {!state.clarification && (
            <div className={styles.menuActions}>
              <button type="button" className={styles.menuAction} disabled={!state.context} onClick={state.explain}>
                <Icon name="question-circle" size="sm" />
                <Trans i18nKey="query-editor-coauthoring.explain-query">Explain this query</Trans>
              </button>
            </div>
          )}
          {state.clarification && <QueryCoauthoringClarificationAction onContinue={state.continueInAssistant} />}
        </>
      )}
      {state.kind === 'explain' && (
        <QueryCoauthoringExplain
          answer={state.answer}
          intent={state.intent}
          onIntentChange={state.setIntent}
          onFollowUp={state.submitFollowUp}
          onModify={state.modify}
          onClose={session.dismiss}
          mention={session.mention}
          mentionMenuRef={mentionMenuRef}
          cursorPosition={session.cursorPosition}
          onCaretChange={session.setCaret}
        />
      )}
      {state.kind === 'working' && (
        <QueryCoauthoringWorking context={state.context} mode={state.mode} onStop={state.stop} />
      )}
      {state.kind === 'context-error' && (
        <div className={styles.contextError} role="alert">
          <QueryCoauthoringHeader onClose={session.dismiss}>
            <div className={styles.headerCopy}>
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="query-editor-coauthoring.context-error">Context failed to load</Trans>
              </Text>
            </div>
            <Button size="sm" variant="secondary" onClick={state.retry}>
              <Trans i18nKey="query-editor-coauthoring.retry-context">Retry</Trans>
            </Button>
          </QueryCoauthoringHeader>
        </div>
      )}
      {state.kind === 'error' && (
        <>
          <QueryCoauthoringHeader onClose={session.dismiss}>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="query-editor-coauthoring.error">Query coauthoring error</Trans>
            </Text>
          </QueryCoauthoringHeader>
          <Stack direction="column" gap={1}>
            <Alert severity="error" title={state.error.message} />
            <Stack gap={1} justifyContent="flex-end">
              {state.retry && (
                <Button size="sm" variant="secondary" onClick={state.retry}>
                  <Trans i18nKey="query-editor-coauthoring.retry">Try again</Trans>
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={session.dismiss}>
                <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
              </Button>
            </Stack>
          </Stack>
        </>
      )}
      {state.kind === 'iteration-nudge' && (
        <QueryCoauthoringIterationNudge
          onContinueHere={state.continueHere}
          onContinueInAssistant={state.continueInAssistant}
        />
      )}
      {state.kind === 'fallback' && (
        <QueryCoauthoringFallback
          reason={state.fallback.reason}
          onClose={session.dismiss}
          onFeedback={state.setFeedback}
          onContinue={state.continueInAssistant}
        />
      )}
      {state.kind === 'proposal' && (
        <QueryCoauthoringProposal
          width={session.groupLayout?.width ?? group.restWidth}
          why={state.proposal.options[state.proposal.selectedIndex]?.why ?? []}
          baseline={state.proposal.context.query}
          diff={state.proposal.options[state.proposal.selectedIndex]?.diff ?? []}
          unconfirmedValues={state.proposal.options[state.proposal.selectedIndex]?.unconfirmedValues}
          optionCount={state.proposal.options.length}
          optionTitles={state.proposal.options.map((option) => option.title)}
          peeking={state.peekIndex !== undefined}
          selectedIndex={state.proposal.selectedIndex}
          onSelect={state.selectOption}
          onPeek={state.peek}
          onStopPeek={state.stopPeek}
          isPreviewRunning={state.isPreviewRunning}
          previewOutcome={state.previewOutcome}
          onFeedback={state.setFeedback}
          onClose={session.dismiss}
          onContinue={state.continueInAssistant}
          onAccept={state.accept}
        />
      )}
    </div>,
    group.surfaceTarget
  );
}
