import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { createAssistantContextItem, createTool, useAssistant, useInlineAssistant } from '@grafana/assistant';
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
  buildIdentificationPrompt,
  buildIdentificationSystemPrompt,
  buildInvalidProposalRepairMessage,
  buildProposalToolDescription,
  invalidQueryResponseMessage,
  MAX_INLINE_CLARIFICATION_RESPONSE_LENGTH,
  multipleResponsesMessage,
  normalizeClarificationMessage,
  normalizeSelectionExplanation,
  type QueryFallback,
  type QueryProposal,
  requestFailedMessage,
  selectionSummary,
  staleQueryResponseMessage,
  unchangedQueryResponseMessage,
  validateFallback,
  validateProposal,
} from './queryCoauthoringPrompts';

interface QueryClarification {
  message: string;
}

interface QueryCoauthoringError {
  message: string;
  retryable: boolean;
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

const VIEWPORT_MARGIN = 8;
const ITERATION_NUDGE_THRESHOLD = 3;
const PROMPT_MESSAGE_ID = 'query-coauthoring-prompt-message';

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
    generate: identifySelection,
    isGenerating: isIdentifying,
    cancel: cancelIdentification,
    reset: resetIdentification,
  } = useInlineAssistant();
  const { generate, isGenerating, cancel, reset } = useInlineAssistant();
  const styles = useStyles2(getQueryCoauthoringStyles);
  const [context, setContext] = useState<QueryEditorCoauthoringContextV1>();
  const [contextError, setContextError] = useState(false);
  const [selectionExplanation, setSelectionExplanation] = useState<string>();
  const [intent, setIntent] = useState('');
  const [proposal, setProposal] = useState<PreparedQueryProposal>();
  const [fallback, setFallback] = useState<StagedFallback>();
  const [clarification, setClarification] = useState<QueryClarification>();
  const [error, setError] = useState<QueryCoauthoringError>();
  const [feedback, setFeedback] = useState<QueryCoauthoringFeedbackState>();
  const [submittedIterationCount, setSubmittedIterationCount] = useState(0);
  const [iterationNudgeDismissed, setIterationNudgeDismissed] = useState(false);
  const [availableHeight, setAvailableHeight] = useState<number>();
  const generationIdRef = useRef(0);
  const identificationIdRef = useRef(0);
  const contextPromiseRef = useRef<Promise<QueryEditorCoauthoringContextV1> | undefined>(undefined);
  const submittedIntentsRef = useRef<string[]>([]);
  const promptUserGestureRef = useRef(false);
  const previewActiveRef = useRef(false);
  const onBaselineRef = useRef(onBaseline);
  const onRevertPreviewRef = useRef(onRevertPreview);
  const identifySelectionRef = useRef(identifySelection);
  const cancelIdentificationRef = useRef(cancelIdentification);
  const datasourceTypeRef = useRef(datasourceType);
  const timeRangeRef = useRef(timeRange);
  const showIterationNudge = submittedIterationCount >= ITERATION_NUDGE_THRESHOLD;
  onRevertPreviewRef.current = onRevertPreview;
  onBaselineRef.current = onBaseline;
  identifySelectionRef.current = identifySelection;
  cancelIdentificationRef.current = cancelIdentification;
  datasourceTypeRef.current = datasourceType;
  timeRangeRef.current = timeRange;

  const revertQueryPreview = useCallback(() => {
    if (!previewActiveRef.current) {
      return;
    }
    previewActiveRef.current = false;
    onRevertPreviewRef.current();
  }, []);

  const clearSession = useCallback(() => {
    generationIdRef.current++;
    identificationIdRef.current++;
    cancelIdentification();
    resetIdentification();
    cancel();
    reset();
    revertQueryPreview();
    setContext(undefined);
    setContextError(false);
    setSelectionExplanation(undefined);
    setIntent('');
    setProposal(undefined);
    setFallback(undefined);
    setClarification(undefined);
    setError(undefined);
    setFeedback(undefined);
    setSubmittedIterationCount(0);
    setIterationNudgeDismissed(false);
    contextPromiseRef.current = undefined;
    submittedIntentsRef.current = [];
    promptUserGestureRef.current = false;
  }, [cancel, cancelIdentification, reset, resetIdentification, revertQueryPreview]);

  const closeFeedback = useCallback(() => {
    setFeedback(undefined);
  }, []);

  const dismiss = useCallback(() => {
    clearSession();
    adapter.dismiss();
  }, [adapter, clearSession]);

  const loadContext = useCallback(() => {
    setContext(undefined);
    setContextError(false);
    const contextPromise = adapter.readInvocation(invocationId).then(({ baseline, context }) => {
      if (!onBaselineRef.current(baseline)) {
        throw new Error('The query coauthoring baseline is no longer current.');
      }
      return context;
    });
    contextPromiseRef.current = contextPromise;
    void contextPromise.then(
      (nextContext) => {
        if (contextPromiseRef.current === contextPromise) {
          setContext(nextContext);
        }
      },
      () => {
        if (contextPromiseRef.current === contextPromise) {
          setContextError(true);
        }
      }
    );
  }, [adapter, invocationId]);

  useEffect(() => {
    if (!context || !isAssistantAvailable) {
      return;
    }

    const identificationState = identificationIdRef;
    const identificationId = ++identificationState.current;
    const fallbackExplanation = selectionSummary(context);
    const identificationDatasourceType = datasourceTypeRef.current;
    const identificationTimeRange = timeRangeRef.current;
    setSelectionExplanation(undefined);
    void identifySelectionRef.current({
      origin: 'grafana/panel-edit-next/query-coauthoring/identify',
      agentName: 'query-coauthor-intent',
      agentId: 'grafana.query.coauthor.identify.v1',
      prompt: buildIdentificationPrompt(context),
      systemPrompt: buildIdentificationSystemPrompt(
        context,
        identificationDatasourceType,
        identificationTimeRange ? { from: identificationTimeRange.from, to: identificationTimeRange.to } : undefined
      ),
      onComplete: (completionText) => {
        if (identificationId === identificationIdRef.current) {
          setSelectionExplanation(normalizeSelectionExplanation(completionText, fallbackExplanation));
        }
      },
      onError: () => {
        if (identificationId === identificationIdRef.current) {
          setSelectionExplanation(fallbackExplanation);
        }
      },
    });

    return () => {
      identificationState.current++;
      cancelIdentificationRef.current();
    };
  }, [context, isAssistantAvailable]);

  useEffect(() => {
    if (!isAssistantAvailable) {
      return;
    }

    const generationId = generationIdRef;
    const identificationId = identificationIdRef;
    loadContext();

    return () => {
      generationId.current++;
      identificationId.current++;
      cancelIdentification();
      cancel();
      revertQueryPreview();
    };
  }, [cancel, cancelIdentification, isAssistantAvailable, loadContext, revertQueryPreview]);

  useLayoutEffect(() => {
    const updateAvailableHeight = () => {
      const anchorTop = Math.max(portalTarget.getBoundingClientRect().top, 0);
      setAvailableHeight(Math.max(window.innerHeight - anchorTop - VIEWPORT_MARGIN, 0));
    };

    let firstSettleFrame: number | undefined;
    let secondSettleFrame: number | undefined;
    const cancelSettle = () => {
      if (firstSettleFrame !== undefined) {
        cancelAnimationFrame(firstSettleFrame);
        firstSettleFrame = undefined;
      }
      if (secondSettleFrame !== undefined) {
        cancelAnimationFrame(secondSettleFrame);
        secondSettleFrame = undefined;
      }
    };
    const settleAvailableHeight = () => {
      cancelSettle();
      firstSettleFrame = requestAnimationFrame(() => {
        firstSettleFrame = undefined;
        updateAvailableHeight();
        secondSettleFrame = requestAnimationFrame(() => {
          secondSettleFrame = undefined;
          updateAvailableHeight();
        });
      });
    };
    const resizeObserver = new ResizeObserver(() => {
      updateAvailableHeight();
      settleAvailableHeight();
    });
    const updateForViewportChange = (event: Event) => {
      if (event.type === 'scroll' && event.target instanceof Node && portalTarget.contains(event.target)) {
        return;
      }
      updateAvailableHeight();
      settleAvailableHeight();
    };

    updateAvailableHeight();
    settleAvailableHeight();
    resizeObserver.observe(portalTarget);
    window.addEventListener('resize', updateForViewportChange);
    window.addEventListener('scroll', updateForViewportChange, true);
    return () => {
      resizeObserver.disconnect();
      cancelSettle();
      window.removeEventListener('resize', updateForViewportChange);
      window.removeEventListener('scroll', updateForViewportChange, true);
    };
  }, [portalTarget]);

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
    identificationIdRef.current++;
    cancelIdentification();

    let submittedContext: QueryEditorCoauthoringContextV1;
    try {
      if (context) {
        submittedContext = context;
      } else if (contextPromiseRef.current) {
        submittedContext = await contextPromiseRef.current;
      } else {
        const invocation = await adapter.readInvocation(invocationId);
        if (!onBaselineRef.current(invocation.baseline)) {
          throw new Error('The query coauthoring baseline is no longer current.');
        }
        submittedContext = invocation.context;
      }
    } catch {
      setContextError(true);
      return;
    }

    submittedIntentsRef.current.push(trimmedIntent);
    promptUserGestureRef.current = false;

    setSubmittedIterationCount((count) => count + 1);

    const generationId = ++generationIdRef.current;
    let submittedProposal: QueryProposal | undefined;
    let submittedPrepared: Extract<QueryEditorCoauthoringProposalResultV1, { status: 'ready' }> | undefined;
    let submittedFallback: QueryFallback | undefined;
    let rejectedTerminalProposal: 'unchanged' | 'stale' | undefined;
    let acceptedTerminalToolCallCount = 0;
    let rejectedInvalidProposalCount = 0;
    let terminalCallbackHandled = false;

    setProposal(undefined);
    setFallback(undefined);
    setClarification(undefined);
    setError(undefined);

    const proposalTool = createTool(
      async (input: QueryProposal) => {
        if (generationId === generationIdRef.current) {
          const prepared = adapter.prepareProposal(invocationId, input.proposedQuery);
          if (prepared.status !== 'ready') {
            if (prepared.reason === 'invalid') {
              rejectedInvalidProposalCount++;
              throw new Error(buildInvalidProposalRepairMessage(submittedContext));
            }
            acceptedTerminalToolCallCount++;
            rejectedTerminalProposal = prepared.reason;
            return prepared.reason === 'stale'
              ? 'The query proposal is no longer current.'
              : 'The query proposal does not change the current query.';
          }
          acceptedTerminalToolCallCount++;
          submittedProposal = input;
          submittedPrepared = prepared;
        }
        return 'The query proposal was received.';
      },
      {
        name: 'submit_query_proposal',
        description: buildProposalToolDescription(submittedContext),
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['proposedQuery', 'why'],
          properties: {
            proposedQuery: { type: 'string', minLength: 1, maxLength: 20_000 },
            why: {
              type: 'array',
              minItems: 1,
              maxItems: 5,
              items: { type: 'string', minLength: 1, maxLength: 500 },
            },
          },
        },
        validate: validateProposal,
      }
    );
    proposalTool.strict = true;

    const fallbackTool = createTool(
      async (input: QueryFallback) => {
        if (generationId === generationIdRef.current) {
          acceptedTerminalToolCallCount++;
          submittedFallback = input;
        }
        return 'The Assistant handoff was received.';
      },
      {
        name: 'request_assistant_handoff',
        description:
          'Use this only when the requested change necessarily requires capabilities beyond this query editor, other queries, data sources, or panel changes, or the user explicitly asks to inspect live data. Keep ambiguous changes to the current query inline by asking one concise clarification question.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 1, maxLength: 500 },
          },
        },
        validate: validateFallback,
      }
    );
    fallbackTool.strict = true;

    await generate({
      origin: 'grafana/panel-edit-next/query-coauthoring',
      agentName: 'query-coauthor',
      agentId: 'grafana.query.coauthor.v1',
      prompt: trimmedIntent,
      systemPrompt: buildCoauthoringSystemPrompt(submittedContext, datasourceType, timeRange),
      tools: [proposalTool, fallbackTool],
      onComplete: (completionText) => {
        if (generationId !== generationIdRef.current || terminalCallbackHandled) {
          return;
        }
        terminalCallbackHandled = true;
        if (acceptedTerminalToolCallCount === 0) {
          const message = normalizeClarificationMessage(completionText);
          if (message) {
            if (message.length > MAX_INLINE_CLARIFICATION_RESPONSE_LENGTH) {
              setFallback({ reason: message.slice(0, 500), context: submittedContext });
            } else {
              setIntent('');
              setClarification({ message });
            }
          } else if (rejectedInvalidProposalCount > 0) {
            setError({ message: invalidQueryResponseMessage(submittedContext), retryable: true });
          } else {
            setError({ message: requestFailedMessage(), retryable: true });
          }
          return;
        }
        if (acceptedTerminalToolCallCount !== 1) {
          setError({ message: multipleResponsesMessage(), retryable: true });
          return;
        }
        if (rejectedTerminalProposal) {
          setError({
            message:
              rejectedTerminalProposal === 'stale' ? staleQueryResponseMessage() : unchangedQueryResponseMessage(),
            retryable: rejectedTerminalProposal === 'unchanged',
          });
          return;
        }
        if (submittedFallback) {
          setFallback({ ...submittedFallback, context: submittedContext });
          return;
        }
        if (!submittedProposal || !submittedPrepared) {
          setError({ message: invalidQueryResponseMessage(submittedContext), retryable: true });
          return;
        }

        if (!onPreview(submittedPrepared.query)) {
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
        setProposal({ ...submittedProposal, context: submittedContext, prepared: submittedPrepared });
      },
      onError: () => {
        if (generationId === generationIdRef.current && !terminalCallbackHandled) {
          terminalCallbackHandled = true;
          setError({ message: requestFailedMessage(), retryable: true });
        }
      },
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
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (feedback) {
          closeFeedback();
        } else {
          dismiss();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [closeFeedback, dismiss, feedback]);

  return createPortal(
    <div
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
                <Text id={PROMPT_MESSAGE_ID} variant="body">
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
              ariaDescribedBy={context && !isIdentifying ? PROMPT_MESSAGE_ID : undefined}
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
