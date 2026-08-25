import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { createAssistantContextItem, useAssistant, useInlineAssistant } from '@grafana/assistant';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Alert, Button, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { getQueryCoauthoringStyles } from './QueryCoauthoring.styles';
import { QueryCoauthoringFeedback, type QueryCoauthoringFeedbackState } from './QueryCoauthoringFeedback';
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
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringProposalResultV1,
} from './internalCoauthoringContract';
import {
  buildAssistantHandoffContext,
  buildAssistantHandoffInstructions,
  buildAssistantHandoffPrompt,
  buildCoauthoringSystemPrompt,
  type QueryFallback,
  type QueryProposal,
  selectionSummary,
} from './queryCoauthoringPrompts';
import {
  createQueryCoauthoringRequest,
  type QueryCoauthoringRequestError,
  type QueryCoauthoringRequestOutcome,
} from './queryCoauthoringRequest';
import { useQueryCoauthoringInvocation } from './useQueryCoauthoringInvocation';
import { useQueryCoauthoringViewport } from './useQueryCoauthoringViewport';

interface QueryClarification {
  message: string;
}

interface PreparedQueryProposal extends QueryProposal {
  context: QueryEditorCoauthoringContextV1;
  prepared: Extract<QueryEditorCoauthoringProposalResultV1, { status: 'ready' }>;
}

interface StagedFallback extends QueryFallback {
  context: QueryEditorCoauthoringContextV1;
}

interface Props {
  adapter: QueryEditorCoauthoringAdapterV1;
  invocationId: string;
  portalTarget: HTMLElement;
  datasourceType: string;
  onBaseline: (query: DataQuery) => boolean;
  onAccept: (query: DataQuery) => boolean;
  onPreview: (query: DataQuery) => boolean;
  onRevertPreview: () => void;
  isPreviewRunning?: boolean;
  timeRange?: { from: number; to: number };
}

const ITERATION_NUDGE_THRESHOLD = 3;

export function QueryCoauthoring({
  adapter,
  invocationId,
  portalTarget,
  datasourceType,
  onBaseline,
  onAccept,
  onPreview,
  onRevertPreview,
  isPreviewRunning = false,
  timeRange,
}: Props) {
  const {
    isLoading: isAssistantLoading,
    isAvailable: isAssistantAvailable,
    openAssistant: openAvailableAssistant,
  } = useAssistant();
  const {
    cancelIdentification,
    clear: clearInvocation,
    context,
    contextError,
    isIdentifying,
    loadContext,
    readContext,
    selectionExplanation,
  } = useQueryCoauthoringInvocation({
    adapter,
    invocationId,
    isAssistantAvailable,
    datasourceType,
    timeRange,
    onBaseline,
  });
  const { generate, isGenerating, cancel, reset } = useInlineAssistant();
  const styles = useStyles2(getQueryCoauthoringStyles);
  const [intent, setIntent] = useState('');
  const [proposal, setProposal] = useState<PreparedQueryProposal>();
  const [fallback, setFallback] = useState<StagedFallback>();
  const [clarification, setClarification] = useState<QueryClarification>();
  const [error, setError] = useState<QueryCoauthoringRequestError>();
  const [feedback, setFeedback] = useState<QueryCoauthoringFeedbackState>();
  const [submittedIterationCount, setSubmittedIterationCount] = useState(0);
  const [iterationNudgeDismissed, setIterationNudgeDismissed] = useState(false);
  const promptMessageId = useId();
  const availableHeight = useQueryCoauthoringViewport(portalTarget);
  const generationIdRef = useRef(0);
  const submittedIntentsRef = useRef<string[]>([]);
  const promptUserGestureRef = useRef(false);
  const previewActiveRef = useRef(false);
  const onRevertPreviewRef = useRef(onRevertPreview);
  const containerRef = useRef<HTMLDivElement>(null);
  const showIterationNudge = submittedIterationCount >= ITERATION_NUDGE_THRESHOLD;
  onRevertPreviewRef.current = onRevertPreview;

  const revertQueryPreview = useCallback(() => {
    if (!previewActiveRef.current) {
      return;
    }
    previewActiveRef.current = false;
    onRevertPreviewRef.current();
  }, []);

  const clearSession = useCallback(() => {
    generationIdRef.current++;
    clearInvocation();
    cancel();
    reset();
    revertQueryPreview();
    setIntent('');
    setProposal(undefined);
    setFallback(undefined);
    setClarification(undefined);
    setError(undefined);
    setFeedback(undefined);
    setSubmittedIterationCount(0);
    setIterationNudgeDismissed(false);
    submittedIntentsRef.current = [];
    promptUserGestureRef.current = false;
  }, [cancel, clearInvocation, reset, revertQueryPreview]);

  const closeFeedback = useCallback(() => {
    setFeedback(undefined);
  }, []);

  const dismiss = useCallback(() => {
    clearSession();
    adapter.dismiss();
  }, [adapter, clearSession]);

  useEffect(() => {
    if (!isAssistantAvailable) {
      return;
    }

    const generationId = generationIdRef;

    return () => {
      generationId.current++;
      cancel();
      revertQueryPreview();
    };
  }, [adapter, cancel, invocationId, isAssistantAvailable, revertQueryPreview]);

  const stop = () => {
    generationIdRef.current++;
    cancel();
    revertQueryPreview();
    setProposal(undefined);
    setFallback(undefined);
    setClarification(undefined);
    setError(undefined);
  };

  const submit = async (nextIntent = intent) => {
    const trimmedIntent = nextIntent.trim();
    if (!trimmedIntent || isGenerating || !isAssistantAvailable) {
      return;
    }
    cancelIdentification();

    let submittedContext: QueryEditorCoauthoringContextV1;
    try {
      submittedContext = await readContext();
    } catch {
      return;
    }

    submittedIntentsRef.current.push(trimmedIntent);
    promptUserGestureRef.current = false;

    setSubmittedIterationCount((count) => count + 1);

    const generationId = ++generationIdRef.current;
    setProposal(undefined);
    setFallback(undefined);
    setClarification(undefined);
    setError(undefined);

    const request = createQueryCoauthoringRequest({
      adapter,
      invocationId,
      context: submittedContext,
      isCurrent: () => generationId === generationIdRef.current,
    });
    const handleOutcome = (outcome: QueryCoauthoringRequestOutcome) => {
      if (outcome.status === 'ignored') {
        return;
      }
      if (outcome.status === 'clarification') {
        setIntent('');
        setClarification({ message: outcome.message });
        return;
      }
      if (outcome.status === 'fallback') {
        setFallback({ ...outcome.fallback, context: submittedContext });
        return;
      }
      if (outcome.status === 'error') {
        setError(outcome.error);
        return;
      }
      if (!onPreview(outcome.prepared.query)) {
        setError({
          message: t(
            'query-editor-coauthoring.error-preview-failed',
            'The query proposal could not be previewed. Try again.'
          ),
          retryable: true,
        });
        return;
      }
      previewActiveRef.current = true;
      setProposal({ ...outcome.proposal, context: submittedContext, prepared: outcome.prepared });
    };

    await generate({
      origin: 'grafana/panel-edit-next/query-coauthoring',
      agentName: 'query-coauthor',
      agentId: 'grafana.query.coauthor.v1',
      prompt: trimmedIntent,
      systemPrompt: buildCoauthoringSystemPrompt(submittedContext, datasourceType, timeRange),
      tools: request.tools,
      onComplete: (completionText) => handleOutcome(request.complete(completionText)),
      onError: () => handleOutcome(request.fail()),
    });
  };

  const accept = useCallback(() => {
    if (!proposal) {
      return;
    }
    if (!onAccept(proposal.prepared.query)) {
      setError({
        message: t(
          'query-editor-coauthoring.error-accept-failed',
          'The query proposal could not be accepted. Try again.'
        ),
        retryable: true,
      });
      return;
    }

    previewActiveRef.current = false;
    dismiss();
  }, [dismiss, onAccept, proposal]);

  const continueInAssistant = (reason?: string) => {
    const activeContext = proposal?.context ?? fallback?.context ?? context;
    if (!activeContext || !openAvailableAssistant) {
      return;
    }
    const intentHistory = [...submittedIntentsRef.current];
    const pendingIntent = intent.trim();
    if (pendingIntent && pendingIntent !== intentHistory.at(-1)) {
      intentHistory.push(pendingIntent);
    }
    const originalIntent = intentHistory[0] ?? '';
    const latestIntent = intentHistory.at(-1) ?? '';
    openAvailableAssistant({
      origin: 'grafana/panel-edit-next/query-coauthoring',
      mode: 'dashboarding',
      autoSend: false,
      prompt: buildAssistantHandoffPrompt(originalIntent, latestIntent, activeContext),
      context: [
        createAssistantContextItem('structured', {
          hidden: false,
          title: t('query-editor-coauthoring.assistant-context-title', 'Query coauthoring context'),
          data: buildAssistantHandoffContext(activeContext, datasourceType, timeRange, proposal, reason, intentHistory),
        }),
        createAssistantContextItem('structured', {
          hidden: true,
          bypassLimits: true,
          title: t('query-editor-coauthoring.assistant-instructions-title', 'Query coauthoring instructions'),
          data: buildAssistantHandoffInstructions(),
        }),
      ],
    });
    dismiss();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (feedback) {
        closeFeedback();
      } else {
        dismiss();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [closeFeedback, dismiss, feedback]);

  return createPortal(
    <div
      ref={containerRef}
      className={styles.container}
      role="dialog"
      aria-label={t('query-editor-coauthoring.dialog', 'Query coauthor')}
      style={availableHeight === undefined ? undefined : { maxHeight: availableHeight }}
    >
      {isAssistantLoading && (
        <QueryCoauthoringHeader onClose={dismiss} pulse>
          <Spinner size="sm" />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="query-editor-coauthoring.checking-assistant">Checking Assistant availability...</Trans>
          </Text>
        </QueryCoauthoringHeader>
      )}
      {!isAssistantLoading && !isAssistantAvailable && (
        <>
          <QueryCoauthoringHeader onClose={dismiss}>
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
              <Button size="sm" variant="secondary" onClick={dismiss}>
                <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
              </Button>
            </Stack>
          </Stack>
        </>
      )}
      {isAssistantAvailable &&
        !isGenerating &&
        !proposal &&
        !fallback &&
        !error &&
        !contextError &&
        (!showIterationNudge || iterationNudgeDismissed || !context) && (
          <>
            <QueryCoauthoringHeader onClose={dismiss} pulse={!context || isIdentifying}>
              {!context || isIdentifying ? (
                <QueryCoauthoringLiveStatus>
                  <Icon name="ai-sparkle" size="sm" />
                  <Text variant="bodySmall" color="secondary">
                    <Trans i18nKey="query-editor-coauthoring.reading-highlighted-query">
                      Reading highlighted query...
                    </Trans>
                  </Text>
                </QueryCoauthoringLiveStatus>
              ) : clarification ? (
                <Text variant="body" color="secondary">
                  <Trans i18nKey="query-editor-coauthoring.clarification-title">Detail requested</Trans>
                </Text>
              ) : (
                <Text variant="body" color="secondary">
                  <Trans i18nKey="query-editor-coauthoring.highlighted-query">Highlighted query</Trans>
                </Text>
              )}
            </QueryCoauthoringHeader>
            {context && !isIdentifying && (
              <div
                className={styles.body}
                data-testid={selectors.components.QueryEditorCoauthoring.container}
                role="region"
                aria-label={
                  clarification
                    ? t('query-editor-coauthoring.clarification-message', 'Clarification message')
                    : t('query-editor-coauthoring.highlighted-query-summary', 'Highlighted query summary')
                }
              >
                <Text id={promptMessageId} variant="body">
                  {clarification?.message ?? selectionExplanation ?? selectionSummary(context)}
                </Text>
              </div>
            )}
          </>
        )}
      {isAssistantAvailable &&
        !isGenerating &&
        !proposal &&
        !fallback &&
        !error &&
        !contextError &&
        (!showIterationNudge || iterationNudgeDismissed || !context) && (
          <>
            <QueryCoauthoringPromptInput
              key={clarification ? `clarification-${submittedIterationCount}` : 'initial'}
              focusTrigger={`${clarification ? `clarification-${submittedIterationCount}` : 'initial'}-${
                selectionExplanation ? 'identified' : 'reading'
              }`}
              userGestureRef={promptUserGestureRef}
              value={intent}
              placeholder={
                clarification
                  ? t('query-editor-coauthoring.clarification-placeholder', 'Add extra detail...')
                  : t('query-editor-coauthoring.prompt-placeholder', 'Describe a quick change...')
              }
              ariaLabel={
                clarification
                  ? t('query-editor-coauthoring.clarification-label', 'Add extra detail')
                  : t('query-editor-coauthoring.prompt-label', 'Describe a query change')
              }
              ariaDescribedBy={context && !isIdentifying ? promptMessageId : undefined}
              actionLabel={
                clarification
                  ? t('query-editor-coauthoring.continue', 'Continue')
                  : t('query-editor-coauthoring.submit', 'Coauthor')
              }
              disabled={!intent.trim() || !context || contextError}
              onChange={setIntent}
              onSubmit={() => void submit()}
            />
            {clarification && (
              <QueryCoauthoringClarificationAction onContinue={() => continueInAssistant(clarification.message)} />
            )}
          </>
        )}
      {isAssistantAvailable && isGenerating && <QueryCoauthoringWorking context={context} onStop={stop} />}
      {isAssistantAvailable && contextError && (
        <>
          <QueryCoauthoringHeader onClose={dismiss}>
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
              <Button size="sm" variant="secondary" onClick={dismiss}>
                <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
              </Button>
              <Button size="sm" variant="secondary" onClick={loadContext}>
                <Trans i18nKey="query-editor-coauthoring.retry">Try again</Trans>
              </Button>
            </Stack>
          </Stack>
        </>
      )}
      {isAssistantAvailable && error && (
        <>
          <QueryCoauthoringHeader onClose={dismiss}>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="query-editor-coauthoring.error">Query coauthoring error</Trans>
            </Text>
          </QueryCoauthoringHeader>
          <Stack direction="column" gap={1}>
            <Alert severity="error" title={error.message} />
            <Stack gap={1} justifyContent="flex-end">
              {error.retryable && (
                <Button size="sm" variant="secondary" onClick={() => setError(undefined)}>
                  <Trans i18nKey="query-editor-coauthoring.retry">Try again</Trans>
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={dismiss}>
                <Trans i18nKey="query-editor-coauthoring.dismiss">Dismiss</Trans>
              </Button>
            </Stack>
          </Stack>
        </>
      )}
      {isAssistantAvailable && context && showIterationNudge && !iterationNudgeDismissed && !proposal && !fallback && (
        <QueryCoauthoringIterationNudge
          onContinueHere={() => setIterationNudgeDismissed(true)}
          onContinueInAssistant={() => continueInAssistant()}
        />
      )}
      {isAssistantAvailable && fallback && (
        <QueryCoauthoringFallback
          reason={fallback.reason}
          onClose={dismiss}
          onFeedback={setFeedback}
          onContinue={continueInAssistant}
        />
      )}
      {isAssistantAvailable && proposal && (
        <QueryCoauthoringProposal
          why={proposal.why}
          changes={proposal.prepared.changes}
          isPreviewRunning={isPreviewRunning}
          onFeedback={setFeedback}
          onClose={dismiss}
          onContinue={() => continueInAssistant()}
          onAccept={accept}
        />
      )}
      {isAssistantAvailable && feedback && <QueryCoauthoringFeedback feedback={feedback} onClose={closeFeedback} />}
    </div>,
    portalTarget
  );
}
