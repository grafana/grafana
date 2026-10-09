import { type MutableRefObject, useCallback, useEffect, useReducer, useRef } from 'react';

import { createAssistantContextItem, useAssistant, useInlineAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';

import { type QueryCoauthoringFeedbackState } from './QueryCoauthoringFeedback';
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
} from './queryCoauthoringPrompts';
import {
  createQueryCoauthoringRequest,
  type QueryCoauthoringRequestError,
  type QueryCoauthoringRequestOutcome,
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
  trackQueryCoauthoringGenerationStopped,
  trackQueryCoauthoringOpened,
  trackQueryCoauthoringPromptSubmitted,
  trackQueryCoauthoringProposalAccepted,
} from './queryCoauthoringTracking';
import { useQueryCoauthoringInvocation } from './useQueryCoauthoringInvocation';

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

interface PromptSessionState {
  kind: 'prompt';
  clarification?: QueryClarification;
  context?: QueryEditorCoauthoringContextV1;
  intent: string;
  isIdentifying: boolean;
  promptUserGestureRef: MutableRefObject<boolean>;
  selectionExplanation?: string;
  submittedIterationCount: number;
  continueInAssistant(): void;
  setIntent(intent: string): void;
  submit(): void;
}

export type QueryCoauthoringSessionState =
  | { kind: 'assistant-loading' }
  | { kind: 'assistant-unavailable' }
  | PromptSessionState
  | { kind: 'working'; context?: QueryEditorCoauthoringContextV1; stop(): void }
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
      proposal: PreparedQueryProposal;
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
  const setIntent = (intent: string): void => {
    send({ type: 'intent-changed', intent });
  };
  const setFeedback = (feedback: QueryCoauthoringFeedbackState): void => {
    send({ type: 'feedback-changed', feedback });
  };

  useEffect(() => {
    send({ type: `assistant-${assistantStatus}` });
  }, [assistantStatus, send]);

  useEffect(() => {
    send({ type: 'invocation-updated', context, isIdentifying, selectionExplanation });
  }, [context, isIdentifying, selectionExplanation, send]);

  useEffect(() => {
    send({ type: contextError ? 'context-failed' : 'context-retried' });
  }, [contextError, send]);

  useEffect(() => {
    send({ type: isGenerating ? 'generation-started' : 'generation-settled' });
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

  useEffect(() => {
    if (!trackedOpenRef.current) {
      trackedOpenRef.current = true;
      trackQueryCoauthoringOpened({ datasourceType });
    }
  }, [datasourceType]);

  useEffect(() => {
    if (!isAssistantAvailable) {
      return;
    }

    return () => {
      send({ type: 'request-invalidated' });
      cancel();
      revertQueryPreview();
    };
  }, [adapter, cancel, invocationId, isAssistantAvailable, revertQueryPreview, send]);

  const stop = () => {
    trackQueryCoauthoringGenerationStopped({ datasourceType });
    send({ type: 'generation-stopped' });
    cancel();
    revertQueryPreview();
  };

  const submit = async (nextIntent = intent) => {
    const trimmedIntent = nextIntent.trim();
    if (!trimmedIntent || isGenerating || !isAssistantAvailable) {
      return;
    }
    cancelIdentification();
    send({ type: 'submission-started' });
    const requestId = sessionRef.current.data.requestId;

    let submittedContext: QueryEditorCoauthoringContextV1;
    try {
      submittedContext = await readContext();
    } catch {
      return;
    }
    if (!send({ type: 'submission-ready', requestId, intent: trimmedIntent })) {
      return;
    }

    trackQueryCoauthoringPromptSubmitted({
      datasourceType,
      promptStage: clarification ? 'clarification' : 'initial',
    });
    promptUserGestureRef.current = false;

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
      if (!onPreview(outcome.prepared.query)) {
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

  const accept = useCallback(() => {
    if (!proposal) {
      return;
    }
    if (!onAccept(proposal.prepared.query)) {
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
  }, [datasourceType, dismiss, onAccept, proposal, send]);

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
      state = { kind: 'working', context, stop };
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
      };
  }

  return { closeFeedback, dismiss: dismissPopover, feedback: session.data.feedback, state };
}
