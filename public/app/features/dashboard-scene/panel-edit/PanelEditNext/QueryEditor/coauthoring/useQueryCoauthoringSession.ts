import { type MutableRefObject, useCallback, useEffect, useReducer, useRef } from 'react';

import { createAssistantContextItem, useAssistant, useInlineAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';

import { type QueryCoauthoringFeedbackState } from './QueryCoauthoringFeedback';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringContextV1,
} from './internalCoauthoringContract';
import { queryCoauthoringMentionOptions, type QueryCoauthoringMentionMenu } from './queryCoauthoringMentions';
import {
  buildAssistantHandoffContext,
  buildAssistantHandoffInstructions,
  buildAssistantHandoffPrompt,
  buildCoauthoringSystemPrompt,
  buildExplainPrompt,
  buildExplainSystemPrompt,
  parseQueryExplanation,
  selectionSummary,
  type QueryExplanation,
  type QueryFallback,
} from './queryCoauthoringPrompts';
import {
  createQueryCoauthoringRequest,
  type QueryCoauthoringRequestError,
  type QueryCoauthoringRequestOutcome,
  type PreparedQueryProposal,
} from './queryCoauthoringRequest';
import {
  createQueryCoauthoringSessionState,
  isCurrentQueryCoauthoringRequest,
  queryCoauthoringSessionReducer,
  type QueryCoauthoringSessionEvent,
} from './queryCoauthoringSessionReducer';
import {
  type QueryCoauthoringHandoffSource,
  trackQueryCoauthoringContinuedInAssistant,
  trackQueryCoauthoringDismissed,
  trackQueryCoauthoringExplainFollowUpSubmitted,
  trackQueryCoauthoringExploreSimilarUsed,
  trackQueryCoauthoringGenerationStopped,
  trackQueryCoauthoringMentionInserted,
  trackQueryCoauthoringOpened,
  trackQueryCoauthoringPromptSubmitted,
  trackQueryCoauthoringProposalAccepted,
  trackQueryCoauthoringOptionSelected,
} from './queryCoauthoringTracking';
import { useQueryCoauthoringInvocation } from './useQueryCoauthoringInvocation';

interface QueryClarification {
  message: string;
}

interface RankedProposal {
  context: QueryEditorCoauthoringContextV1;
  options: PreparedQueryProposal[];
  selectedIndex: number;
}

interface StagedFallback extends QueryFallback {
  context: QueryEditorCoauthoringContextV1;
}

interface PromptSessionState {
  kind: 'prompt';
  clarification?: QueryClarification;
  context?: QueryEditorCoauthoringContextV1;
  intent: string;
  promptUserGestureRef: MutableRefObject<boolean>;
  submittedModifyCount: number;
  continueInAssistant(): void;
  setIntent(intent: string, caret?: number): void;
  submit(): void;
  explain(): void;
  exploreSimilar(): void;
}

export type QueryCoauthoringSessionState =
  | { kind: 'assistant-loading' }
  | { kind: 'assistant-unavailable' }
  | PromptSessionState
  | {
      kind: 'explain';
      context: QueryEditorCoauthoringContextV1;
      answer: QueryExplanation;
      intent: string;
      setIntent(intent: string, caret?: number): void;
      submitFollowUp(question?: string): void;
      modify(): void;
    }
  | { kind: 'working'; context?: QueryEditorCoauthoringContextV1; mode: 'modify' | 'explain'; stop(): void }
  | { kind: 'context-error'; retry(): void }
  | { kind: 'error'; error: QueryCoauthoringRequestError; retry?(): void }
  | { kind: 'iteration-nudge'; continueHere(): void; continueInAssistant(): void }
  | {
      kind: 'fallback';
      fallback: StagedFallback;
      continueInAssistant(reason: string): void;
      setFeedback(feedback: QueryCoauthoringFeedbackState): void;
    }
  | {
      kind: 'proposal';
      isPreviewRunning: boolean;
      proposal: RankedProposal;
      selectOption(index: number): void;
      accept(): void;
      continueInAssistant(): void;
      setFeedback(feedback: QueryCoauthoringFeedbackState): void;
    };

export interface QueryCoauthoringSessionOptions {
  adapter: QueryEditorCoauthoringAdapterV1;
  invocationId: string;
  datasourceType: string;
  onBaseline: (query: DataQuery) => boolean;
  onAccept: (query: DataQuery) => boolean;
  onPreview: (query: DataQuery) => boolean;
  onRevertPreview: () => void;
  isPreviewRunning?: boolean;
  timeRange?: { from: number; to: number };
}

function explainFailure(): QueryCoauthoringRequestError {
  return {
    message: t('query-editor-coauthoring.explain-failed', 'Assistant could not explain this query. Try again.'),
    retryable: true,
  };
}

export function useQueryCoauthoringSession({
  adapter,
  invocationId,
  datasourceType,
  onBaseline,
  onAccept,
  onPreview,
  onRevertPreview,
  isPreviewRunning = false,
  timeRange,
}: QueryCoauthoringSessionOptions) {
  const {
    isLoading: isAssistantLoading,
    isAvailable: isAssistantAvailable,
    openAssistant: openAvailableAssistant,
  } = useAssistant();
  const {
    clear: clearInvocation,
    context,
    contextError,
    loadContext,
    readContext,
    readBaseline,
  } = useQueryCoauthoringInvocation({
    adapter,
    invocationId,
    isAssistantAvailable,
    onBaseline,
  });
  const { generate, isGenerating, cancel, reset } = useInlineAssistant();
  const assistantStatus = isAssistantLoading ? 'loading' : isAssistantAvailable ? 'ready' : 'unavailable';
  const [session, dispatch] = useReducer(
    queryCoauthoringSessionReducer,
    assistantStatus,
    createQueryCoauthoringSessionState
  );
  const sessionRef = useRef(session);
  // Assistant tools and host callbacks may run before React commits a dispatch.
  // Apply the same reducer synchronously so cancellation wins those races too.
  const send = useCallback((event: QueryCoauthoringSessionEvent): boolean => {
    const previous = sessionRef.current;
    const next = queryCoauthoringSessionReducer(previous, event);
    sessionRef.current = next;
    dispatch(event);
    return next !== previous;
  }, []);
  const { intent, clarification } = session.data.prompt;
  const proposal = session.kind === 'proposal' ? session.proposal : undefined;
  const fallback = session.kind === 'fallback' ? session.fallback : undefined;
  const setIntent = (intent: string, caret?: number): void => {
    send({ type: 'intent-changed', intent, caret });
  };
  const setFeedback = (feedback: QueryCoauthoringFeedbackState): void => {
    send({
      type: 'feedback-changed',
      feedback:
        proposal && feedback.outcome === 'proposal'
          ? {
              ...feedback,
              selectedOptionRank: proposal.selectedIndex + 1,
              optionCount: proposal.options.length,
            }
          : feedback,
    });
  };

  useEffect(() => {
    send({ type: `assistant-${assistantStatus}` });
  }, [assistantStatus, send]);

  useEffect(() => {
    send({ type: 'invocation-updated', context });
  }, [context, send]);

  useEffect(() => {
    send({ type: contextError ? 'context-failed' : 'context-retried' });
  }, [contextError, send]);

  useEffect(() => {
    send(isGenerating ? { type: 'generation-started' } : { type: 'generation-settled', error: explainFailure() });
  }, [isGenerating, send]);

  useEffect(() => {
    send({ type: 'preview-running-changed', isPreviewRunning });
  }, [isPreviewRunning, send]);
  const promptUserGestureRef = useRef(false);
  const previewActiveRef = useRef(false);
  const trackedOpenRef = useRef(false);
  const onRevertPreviewRef = useRef(onRevertPreview);
  onRevertPreviewRef.current = onRevertPreview;

  const revertQueryPreview = useCallback(() => {
    if (previewActiveRef.current) {
      previewActiveRef.current = false;
      onRevertPreviewRef.current();
    }
  }, []);

  const clear = useCallback(() => {
    send({ type: 'invocation-cleared' });
    clearInvocation();
    cancel();
    reset();
    revertQueryPreview();
    promptUserGestureRef.current = false;
  }, [cancel, clearInvocation, reset, revertQueryPreview, send]);

  const closeFeedback = useCallback((): void => {
    send({ type: 'feedback-changed' });
  }, [send]);
  const dismiss = useCallback(() => {
    clear();
    adapter.dismiss();
  }, [adapter, clear]);
  const dismissPopover = useCallback(() => {
    trackQueryCoauthoringDismissed({ datasourceType });
    dismiss();
  }, [datasourceType, dismiss]);
  const dismissUntouched = useCallback(() => {
    if (!sessionRef.current.data.engaged) {
      dismissPopover();
    }
  }, [dismissPopover]);

  useEffect(() => {
    if (!trackedOpenRef.current) {
      trackedOpenRef.current = true;
      trackQueryCoauthoringOpened({ datasourceType });
    }
  }, [datasourceType]);

  useEffect(() => {
    return () => {
      send({ type: 'request-invalidated' });
      cancel();
      revertQueryPreview();
    };
  }, [adapter, cancel, invocationId, revertQueryPreview, send]);

  useEffect(() => {
    if (!isAssistantAvailable && sessionRef.current.data.activeRequestId !== undefined) {
      send({ type: 'generation-stopped' });
      cancel();
    }
  }, [cancel, isAssistantAvailable, send]);

  const stop = () => {
    trackQueryCoauthoringGenerationStopped({ datasourceType });
    send({ type: 'generation-stopped' });
    cancel();
    revertQueryPreview();
  };

  const beginRequest = async (nextIntent: string, mode: 'modify' | 'explain') => {
    const trimmedIntent = nextIntent.trim();
    if (!trimmedIntent || !isAssistantAvailable || sessionRef.current.data.activeRequestId !== undefined) {
      return;
    }
    send({ type: 'submission-started', mode, intent: trimmedIntent });
    const requestId = sessionRef.current.data.requestId;

    let submittedContext: QueryEditorCoauthoringContextV1;
    try {
      submittedContext = await readContext();
    } catch {
      if (isCurrentQueryCoauthoringRequest(sessionRef.current, requestId)) {
        send({ type: 'request-invalidated' });
      }
      return;
    }
    if (!send({ type: 'submission-ready', requestId, intent: trimmedIntent })) {
      return;
    }

    promptUserGestureRef.current = false;
    return { trimmedIntent, requestId, submittedContext };
  };

  const submit = async (nextIntent = intent) => {
    const submission = await beginRequest(nextIntent, 'modify');
    if (!submission || !isCurrentQueryCoauthoringRequest(sessionRef.current, submission.requestId)) {
      return;
    }
    const { trimmedIntent, requestId, submittedContext } = submission;

    trackQueryCoauthoringPromptSubmitted({
      datasourceType,
      promptStage: clarification ? 'clarification' : 'initial',
    });
    const request = createQueryCoauthoringRequest({
      adapter,
      invocationId,
      context: submittedContext,
      isCurrent: () => isCurrentQueryCoauthoringRequest(sessionRef.current, requestId),
    });
    const handleOutcome = (outcome: QueryCoauthoringRequestOutcome) => {
      if (!send({ type: 'request-completed', requestId, context: submittedContext, outcome })) {
        return;
      }
      if (outcome.status !== 'proposal') {
        return;
      }
      if (!onPreview(outcome.options[0].prepared.query)) {
        send({
          type: 'preview-failed',
          error: {
            message: t(
              'query-editor-coauthoring.error-preview-failed',
              'The query proposal could not be previewed. Try again.'
            ),
            retryable: true,
          },
        });
        return;
      }
      previewActiveRef.current = true;
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

  const explain = async (nextIntent: string, source?: 'generated' | 'typed', exploreSimilar = false) => {
    const previousExplanation = session.kind === 'explain' ? session.answer : undefined;
    const submission = await beginRequest(nextIntent, 'explain');
    if (!submission || !isCurrentQueryCoauthoringRequest(sessionRef.current, submission.requestId)) {
      return;
    }
    const { trimmedIntent, requestId, submittedContext } = submission;
    if (source) {
      trackQueryCoauthoringExplainFollowUpSubmitted(source);
    }
    if (exploreSimilar) {
      trackQueryCoauthoringExploreSimilarUsed();
    }
    const fail = () =>
      send({
        type: 'request-completed',
        requestId,
        context: submittedContext,
        outcome: { status: 'error', error: explainFailure() },
      });
    try {
      await generate({
        origin: 'grafana/panel-edit-next/query-coauthoring/explain',
        agentName: 'query-coauthor-explain',
        agentId: 'grafana.query.coauthor.explain.v1',
        prompt: trimmedIntent,
        systemPrompt: buildExplainSystemPrompt(
          submittedContext,
          datasourceType,
          source === undefined ? { kind: 'initial' } : { kind: 'follow-up', question: trimmedIntent },
          timeRange,
          previousExplanation
        ),
        onComplete: (text) =>
          send({
            type: 'explanation-completed',
            requestId,
            context: submittedContext,
            answer: parseQueryExplanation(text, selectionSummary(submittedContext)),
          }),
        onError: fail,
      });
    } finally {
      if (isCurrentQueryCoauthoringRequest(sessionRef.current, requestId)) {
        fail();
        cancel();
      }
    }
  };

  const accept = useCallback(() => {
    const current = sessionRef.current;
    const selected = current.kind === 'proposal' ? current.proposal.options[current.proposal.selectedIndex] : undefined;
    if (!selected) {
      return;
    }
    if (!onAccept(selected.prepared.query)) {
      send({
        type: 'accept-failed',
        error: {
          message: t(
            'query-editor-coauthoring.error-accept-failed',
            'The query proposal could not be accepted. Try again.'
          ),
          retryable: true,
        },
      });
      return;
    }

    previewActiveRef.current = false;
    trackQueryCoauthoringProposalAccepted({ datasourceType });
    dismiss();
  }, [datasourceType, dismiss, onAccept, send]);

  const selectOption = (index: number) => {
    const current = sessionRef.current;
    if (current.kind !== 'proposal') {
      return;
    }
    const proposal = current.proposal;
    if (index < -1 || index >= proposal.options.length || index === proposal.selectedIndex) {
      return;
    }
    const query = index < 0 ? readBaseline() : proposal.options[index].prepared.query;
    if (!query || !onPreview(query)) {
      send({
        type: 'preview-failed',
        error: {
          message: t(
            'query-editor-coauthoring.error-preview-failed',
            'The query proposal could not be previewed. Try again.'
          ),
          retryable: true,
        },
      });
      return;
    }
    send({ type: 'option-selected', index });
    trackQueryCoauthoringOptionSelected(index + 1);
  };

  const continueInAssistant = (sourceState: QueryCoauthoringHandoffSource, reason?: string) => {
    const activeContext = proposal?.context ?? fallback?.context ?? context;
    if (!activeContext || !openAvailableAssistant) {
      return;
    }
    const intentHistory = [...session.data.submittedIntents];
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
    trackQueryCoauthoringContinuedInAssistant({ datasourceType, sourceState });
    dismiss();
  };

  let state: QueryCoauthoringSessionState;
  switch (session.kind) {
    case 'assistant-loading':
    case 'assistant-unavailable':
      state = { kind: session.kind };
      break;
    case 'working':
      state = { kind: 'working', context: session.context ?? context, mode: session.mode, stop };
      break;
    case 'explain':
      state = {
        kind: 'explain',
        context: session.context,
        answer: session.answer,
        intent: session.intent,
        setIntent: (intent, caret) => send({ type: 'follow-up-changed', intent, caret }),
        submitFollowUp: (question) =>
          void explain(question ?? session.intent, question === undefined ? 'typed' : 'generated'),
        modify: () => send({ type: 'modify-started' }),
      };
      break;
    case 'context-error':
      state = { kind: 'context-error', retry: loadContext };
      break;
    case 'error':
      state = {
        kind: 'error',
        error: session.error,
        retry: session.error.retryable ? () => send({ type: 'error-retried' }) : undefined,
      };
      break;
    case 'iteration-nudge':
      state = {
        kind: 'iteration-nudge',
        continueHere: () => send({ type: 'iteration-continued' }),
        continueInAssistant: () => continueInAssistant('iteration_nudge'),
      };
      break;
    case 'fallback':
      state = {
        kind: 'fallback',
        fallback: session.fallback,
        continueInAssistant: (reason) => continueInAssistant('fallback', reason),
        setFeedback,
      };
      break;
    case 'proposal':
      state = {
        kind: 'proposal',
        isPreviewRunning: session.isPreviewRunning,
        proposal: session.proposal,
        selectOption,
        accept,
        continueInAssistant: () => continueInAssistant('proposal'),
        setFeedback,
      };
      break;
    case 'prompt':
      state = {
        ...session.data.prompt,
        promptUserGestureRef,
        continueInAssistant: () => continueInAssistant('clarification', clarification?.message),
        setIntent,
        submit: () => void submit(),
        explain: () => {
          if (context) {
            void explain(buildExplainPrompt(context));
          }
        },
        exploreSimilar: () => {
          if (context?.metadata.length) {
            void explain('Explore similar metrics and labels from the provided context.', undefined, true);
          }
        },
      };
  }

  const options =
    session.data.mention && (session.kind === 'prompt' || session.kind === 'explain')
      ? queryCoauthoringMentionOptions(session.context, session.data.mention.query)
      : [];
  const mention: QueryCoauthoringMentionMenu | undefined =
    options.length && session.data.mention
      ? {
          options,
          selectedIndex: Math.min(session.data.mention.selectedIndex, options.length - 1),
          move: (direction) => send({ type: 'mention-moved', direction }),
          select: (index) => {
            const current = sessionRef.current;
            if (!current.data.mention || (current.kind !== 'prompt' && current.kind !== 'explain')) {
              return;
            }
            const selectedIndex = index ?? current.data.mention.selectedIndex;
            const option = queryCoauthoringMentionOptions(current.context, current.data.mention.query)[selectedIndex];
            if (option && send({ type: 'mention-selected', index: selectedIndex })) {
              trackQueryCoauthoringMentionInserted(option.kind);
            }
          },
        }
      : undefined;
  return {
    closeFeedback,
    dismiss: dismissPopover,
    dismissUntouched,
    feedback: session.data.feedback,
    state,
    mention,
    cursorPosition: session.data.cursorPosition,
    setCaret: (caret: number) => send({ type: 'mention-caret-changed', caret }),
    closeMention: () => send({ type: 'mention-closed' }),
  };
}
