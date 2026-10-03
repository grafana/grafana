import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { getQueryCoauthoringStyles } from './QueryCoauthoring.styles';
import { QueryCoauthoringFeedback } from './QueryCoauthoringFeedback';
import {
  QueryCoauthoringClarificationAction,
  QueryCoauthoringFallback,
  QueryCoauthoringHeader,
  QueryCoauthoringIterationNudge,
  QueryCoauthoringLiveStatus,
  QueryCoauthoringPromptInput,
  QueryCoauthoringProposal,
  QueryCoauthoringWorking,
} from './QueryCoauthoringViews';
import { selectionSummary } from './queryCoauthoringPrompts';
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
  const session = useQueryCoauthoringSession(sessionOptions);
  const focusState = session.state.kind;
  const previousFocusStateRef = useRef(focusState);

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
      if (session.feedback) {
        session.closeFeedback();
      } else {
        session.dismiss();
      }
    },
    [session]
  );

  const state = session.state;

  return createPortal(
    <div
      ref={containerRef}
      className={styles.container}
      role="dialog"
      aria-label={t('query-editor-coauthoring.dialog', 'Query coauthor')}
      tabIndex={-1}
      onKeyDownCapture={onKeyDownCapture}
      style={availableHeight === undefined ? undefined : { maxHeight: availableHeight }}
    >
      {state.kind === 'assistant-loading' && (
        <QueryCoauthoringHeader onClose={session.dismiss} pulse>
          <Spinner size="sm" />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="query-editor-coauthoring.checking-assistant">Checking Assistant availability...</Trans>
          </Text>
        </QueryCoauthoringHeader>
      )}
      {state.kind === 'assistant-unavailable' && (
        <>
          <QueryCoauthoringHeader onClose={session.dismiss}>
            <Text variant="bodySmall" weight="medium">
              <Trans i18nKey="query-editor-coauthoring.assistant-unavailable">Assistant is not available</Trans>
            </Text>
          </QueryCoauthoringHeader>
          <Stack direction="column" gap={1}>
            <Alert
              severity="warning"
              title={t('query-editor-coauthoring.assistant-unavailable', 'Assistant is not available')}
            >
              <Trans i18nKey="query-editor-coauthoring.assistant-unavailable-body">
                Query coauthoring requires Grafana Assistant.
              </Trans>
            </Alert>
            <Stack justifyContent="flex-end">
              <Button size="sm" variant="secondary" onClick={session.dismiss}>
                <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
              </Button>
            </Stack>
          </Stack>
        </>
      )}
      {state.kind === 'prompt' && (
        <>
          <QueryCoauthoringHeader onClose={session.dismiss} pulse={!state.context || state.isIdentifying}>
            {!state.context || state.isIdentifying ? (
              <QueryCoauthoringLiveStatus>
                <Icon name="ai-sparkle" size="sm" />
                <Text variant="bodySmall" color="secondary">
                  <Trans i18nKey="query-editor-coauthoring.reading-highlighted-query">
                    Reading highlighted query...
                  </Trans>
                </Text>
              </QueryCoauthoringLiveStatus>
            ) : state.clarification ? (
              <Text variant="body" color="secondary">
                <Trans i18nKey="query-editor-coauthoring.clarification-title">Detail requested</Trans>
              </Text>
            ) : (
              <Text variant="body" color="secondary">
                <Trans i18nKey="query-editor-coauthoring.highlighted-query">Highlighted query</Trans>
              </Text>
            )}
          </QueryCoauthoringHeader>
          {state.context && !state.isIdentifying && (
            <div
              className={styles.body}
              data-testid={selectors.components.QueryEditorCoauthoring.container}
              role="region"
              aria-label={
                state.clarification
                  ? t('query-editor-coauthoring.clarification-message', 'Clarification message')
                  : t('query-editor-coauthoring.highlighted-query-summary', 'Highlighted query summary')
              }
            >
              <Text id={promptMessageId} variant="body">
                {state.clarification?.message ?? state.selectionExplanation ?? selectionSummary(state.context)}
              </Text>
            </div>
          )}
          <QueryCoauthoringPromptInput
            key={state.clarification ? `clarification-${state.submittedIterationCount}` : 'initial'}
            focusTrigger={`${state.clarification ? `clarification-${state.submittedIterationCount}` : 'initial'}-${
              state.selectionExplanation ? 'identified' : 'reading'
            }`}
            userGestureRef={state.promptUserGestureRef}
            value={state.intent}
            placeholder={
              state.clarification
                ? t('query-editor-coauthoring.clarification-placeholder', 'Add extra detail...')
                : t('query-editor-coauthoring.prompt-placeholder', 'Describe a quick change...')
            }
            ariaLabel={
              state.clarification
                ? t('query-editor-coauthoring.clarification-label', 'Add extra detail')
                : t('query-editor-coauthoring.prompt-label', 'Describe a query change')
            }
            ariaDescribedBy={state.context && !state.isIdentifying ? promptMessageId : undefined}
            actionLabel={
              state.clarification
                ? t('query-editor-coauthoring.continue', 'Continue')
                : t('query-editor-coauthoring.submit', 'Coauthor')
            }
            disabled={!state.intent.trim() || !state.context}
            onChange={state.setIntent}
            onSubmit={state.submit}
          />
          {state.clarification && <QueryCoauthoringClarificationAction onContinue={state.continueInAssistant} />}
        </>
      )}
      {state.kind === 'working' && <QueryCoauthoringWorking context={state.context} onStop={state.stop} />}
      {state.kind === 'context-error' && (
        <>
          <QueryCoauthoringHeader onClose={session.dismiss}>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="query-editor-coauthoring.context-error">Could not read the selected query context</Trans>
            </Text>
          </QueryCoauthoringHeader>
          <Stack direction="column" gap={1}>
            <Alert
              severity="error"
              title={t('query-editor-coauthoring.context-error', 'Could not read the selected query context')}
            />
            <Stack gap={1} justifyContent="flex-end">
              <Button size="sm" variant="secondary" onClick={session.dismiss}>
                <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
              </Button>
              <Button size="sm" variant="secondary" onClick={state.retry}>
                <Trans i18nKey="query-editor-coauthoring.retry">Try again</Trans>
              </Button>
            </Stack>
          </Stack>
        </>
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
          why={state.proposal.why}
          changes={state.proposal.prepared.changes}
          isPreviewRunning={state.isPreviewRunning}
          onFeedback={state.setFeedback}
          onClose={session.dismiss}
          onContinue={state.continueInAssistant}
          onAccept={state.accept}
        />
      )}
      {session.feedback && <QueryCoauthoringFeedback feedback={session.feedback} onClose={session.closeFeedback} />}
    </div>,
    portalTarget
  );
}
