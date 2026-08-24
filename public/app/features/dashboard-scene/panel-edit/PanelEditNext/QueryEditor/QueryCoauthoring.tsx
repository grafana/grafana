import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { createAssistantContextItem, createTool, useAssistant, useInlineAssistant } from '@grafana/assistant';
import {
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringControllerV1,
  type QueryEditorCoauthoringProposalResultV1,
} from '@grafana/data';
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
  validateFallback,
  validateProposal,
} from './queryCoauthoringPrompts';

interface QueryClarification {
  message: string;
}

interface StagedQueryProposal extends QueryProposal {
  baseline: string;
  context: QueryEditorCoauthoringContextV1;
  staged: Extract<QueryEditorCoauthoringProposalResultV1, { status: 'staged' }>;
}

interface StagedFallback extends QueryFallback {
  context: QueryEditorCoauthoringContextV1;
}

interface Props {
  controller: QueryEditorCoauthoringControllerV1;
  datasourceType: string;
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
  controller,
  datasourceType,
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
  const [proposal, setProposal] = useState<StagedQueryProposal>();
  const [fallback, setFallback] = useState<StagedFallback>();
  const [clarification, setClarification] = useState<QueryClarification>();
  const [error, setError] = useState<string>();
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
  const onRevertPreviewRef = useRef(onRevertPreview);
  const timeRangeFrom = timeRange?.from;
  const timeRangeTo = timeRange?.to;
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
    identificationIdRef.current++;
    cancelIdentification();
    resetIdentification();
    cancel();
    reset();
    controller.clearEditorDiff();
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
  }, [cancel, cancelIdentification, controller, reset, resetIdentification, revertQueryPreview]);

  const closeFeedback = useCallback(() => {
    setFeedback(undefined);
  }, []);

  const dismiss = useCallback(() => {
    clearSession();
    controller.dismiss();
    controller.focus();
  }, [clearSession, controller]);

  const loadContext = useCallback(() => {
    setContext(undefined);
    setContextError(false);
    const contextPromise = controller.begin();
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
  }, [controller]);

  useEffect(() => {
    if (!context || !isAssistantAvailable) {
      return;
    }

    const identificationState = identificationIdRef;
    const identificationId = ++identificationState.current;
    const fallbackExplanation = selectionSummary(context);
    setSelectionExplanation(undefined);
    void identifySelection({
      origin: 'grafana/panel-edit-next/query-coauthoring/identify',
      agentName: 'query-coauthor-intent',
      agentId: 'grafana.query.coauthor.identify.v1',
      prompt: buildIdentificationPrompt(context),
      systemPrompt: buildIdentificationSystemPrompt(
        context,
        datasourceType,
        timeRangeFrom === undefined || timeRangeTo === undefined ? undefined : { from: timeRangeFrom, to: timeRangeTo }
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
      cancelIdentification();
    };
  }, [
    cancelIdentification,
    context,
    datasourceType,
    identifySelection,
    isAssistantAvailable,
    timeRangeFrom,
    timeRangeTo,
  ]);

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
      controller.clearEditorDiff();
      revertQueryPreview();
    };
  }, [cancel, cancelIdentification, controller, isAssistantAvailable, loadContext, revertQueryPreview]);

  useLayoutEffect(() => {
    const portalTarget = controller.getPortalTarget();

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
  }, [controller]);

  const stop = () => {
    generationIdRef.current++;
    cancel();
    controller.clearEditorDiff();
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
      submittedContext = context ?? (await contextPromiseRef.current) ?? (await controller.begin());
    } catch {
      setContextError(true);
      return;
    }

    const baseline = submittedContext.query;
    if (controller.getQueryText() !== baseline) {
      setError(
        t('query-editor-coauthoring.error-query-changed-before-submit', 'The query changed. Select it again and retry.')
      );
      return;
    }

    submittedIntentsRef.current.push(trimmedIntent);
    promptUserGestureRef.current = false;

    setSubmittedIterationCount((count) => count + 1);

    const generationId = ++generationIdRef.current;
    let submittedProposal: QueryProposal | undefined;
    let submittedStaged: Extract<QueryEditorCoauthoringProposalResultV1, { status: 'staged' }> | undefined;
    let submittedFallback: QueryFallback | undefined;
    let acceptedTerminalToolCallCount = 0;
    let rejectedProposalCount = 0;
    let terminalCallbackHandled = false;

    controller.clearEditorDiff();
    setProposal(undefined);
    setFallback(undefined);
    setClarification(undefined);
    setError(undefined);

    const proposalTool = createTool(
      async (input: QueryProposal) => {
        if (generationId === generationIdRef.current) {
          if (controller.getQueryText() !== baseline) {
            throw new Error('The query changed while Assistant was working. Do not submit another proposal.');
          }
          const staged = controller.stageEditorDiff(input.proposedQuery);
          if (staged.status !== 'staged') {
            rejectedProposalCount++;
            throw new Error(buildInvalidProposalRepairMessage(submittedContext));
          }
          acceptedTerminalToolCallCount++;
          submittedProposal = input;
          submittedStaged = staged;
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
        if (controller.getQueryText() !== baseline) {
          controller.clearEditorDiff();
          setError(
            t(
              'query-editor-coauthoring.error-query-changed',
              'The query changed while Assistant was working. Select it again and retry.'
            )
          );
          return;
        }
        if (acceptedTerminalToolCallCount === 0) {
          const message = normalizeClarificationMessage(completionText);
          if (message) {
            if (message.length > MAX_INLINE_CLARIFICATION_RESPONSE_LENGTH) {
              setFallback({ reason: message.slice(0, 500), context: submittedContext });
            } else {
              setIntent('');
              setClarification({ message });
            }
          } else if (rejectedProposalCount > 0) {
            setError(invalidQueryResponseMessage(submittedContext));
          } else {
            setError(requestFailedMessage());
          }
          return;
        }
        if (acceptedTerminalToolCallCount !== 1) {
          controller.clearEditorDiff();
          setError(multipleResponsesMessage());
          return;
        }
        if (submittedFallback) {
          setFallback({ ...submittedFallback, context: submittedContext });
          return;
        }
        if (!submittedProposal || !submittedStaged) {
          controller.clearEditorDiff();
          setError(invalidQueryResponseMessage(submittedContext));
          return;
        }

        if (!onPreview(submittedStaged.query)) {
          controller.clearEditorDiff();
          setError(
            t('query-editor-coauthoring.error-preview-failed', 'The query proposal could not be previewed. Try again.')
          );
          return;
        }
        previewActiveRef.current = true;
        setProposal({ ...submittedProposal, baseline, context: submittedContext, staged: submittedStaged });
      },
      onError: () => {
        if (generationId === generationIdRef.current && !terminalCallbackHandled) {
          terminalCallbackHandled = true;
          controller.clearEditorDiff();
          setError(requestFailedMessage());
        }
      },
    });
  };

  const accept = useCallback(() => {
    if (!proposal) {
      return;
    }
    if (controller.getQueryText() !== proposal.baseline) {
      controller.clearEditorDiff();
      revertQueryPreview();
      setProposal(undefined);
      setError(
        t(
          'query-editor-coauthoring.error-query-changed-before-accept',
          'The query changed before the proposal was accepted. Select it again and retry.'
        )
      );
      return;
    }

    if (!onAccept(proposal.staged.query)) {
      setError(
        t('query-editor-coauthoring.error-accept-failed', 'The query proposal could not be accepted. Try again.')
      );
      return;
    }

    previewActiveRef.current = false;
    dismiss();
  }, [controller, dismiss, onAccept, proposal, revertQueryPreview]);

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
                data-testid="query-coauthoring-scroll-body"
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
            <Alert severity="error" title={error} />
            <Stack gap={1} justifyContent="flex-end">
              <Button size="sm" variant="secondary" onClick={() => setError(undefined)}>
                <Trans i18nKey="query-editor-coauthoring.retry">Try again</Trans>
              </Button>
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
          changes={proposal.staged.changes}
          isPreviewRunning={isPreviewRunning}
          onFeedback={setFeedback}
          onClose={dismiss}
          onContinue={() => continueInAssistant()}
          onAccept={accept}
        />
      )}
      {isAssistantAvailable && feedback && <QueryCoauthoringFeedback feedback={feedback} onClose={closeFeedback} />}
    </div>,
    controller.getPortalTarget()
  );
}
