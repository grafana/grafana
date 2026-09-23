import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

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

const ITERATION_NUDGE_THRESHOLD = 3;

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
  const [intent, setIntent] = useState('');
  const [proposal, setProposal] = useState<PreparedQueryProposal>();
  const [fallback, setFallback] = useState<StagedFallback>();
  const [clarification, setClarification] = useState<QueryClarification>();
  const [error, setError] = useState<QueryCoauthoringRequestError>();
  const [feedback, setFeedback] = useState<QueryCoauthoringFeedbackState>();
  const [submittedIterationCount, setSubmittedIterationCount] = useState(0);
  const [iterationNudgeDismissed, setIterationNudgeDismissed] = useState(false);
  const generationIdRef = useRef(0);
  const submittedIntentsRef = useRef<string[]>([]);
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

  const closeFeedback = useCallback(() => setFeedback(undefined), []);
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

    const generationId = generationIdRef;
    return () => {
      generationId.current++;
      cancel();
      revertQueryPreview();
    };
  }, [adapter, cancel, invocationId, isAssistantAvailable, revertQueryPreview]);

  const stop = () => {
    trackQueryCoauthoringGenerationStopped({ datasourceType });
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
    const generationId = ++generationIdRef.current;

    let submittedContext: QueryEditorCoauthoringContextV1;
    try {
      submittedContext = await readContext();
    } catch {
      return;
    }
    if (generationId !== generationIdRef.current) {
      return;
    }

    trackQueryCoauthoringPromptSubmitted({
      datasourceType,
      promptStage: clarification ? 'clarification' : 'initial',
    });
    submittedIntentsRef.current.push(trimmedIntent);
    promptUserGestureRef.current = false;
    setSubmittedIterationCount((count) => count + 1);
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
    trackQueryCoauthoringProposalAccepted({ datasourceType });
    dismiss();
  }, [datasourceType, dismiss, onAccept, proposal]);

  const continueInAssistant = (sourceState: QueryCoauthoringHandoffSource, reason?: string) => {
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
    trackQueryCoauthoringContinuedInAssistant({ datasourceType, sourceState });
    dismiss();
  };

  const showIterationNudge =
    submittedIterationCount >= ITERATION_NUDGE_THRESHOLD &&
    !iterationNudgeDismissed &&
    Boolean(context) &&
    Boolean(clarification) &&
    !isGenerating &&
    !proposal &&
    !fallback &&
    !error &&
    !contextError;

  let state: QueryCoauthoringSessionState;
  if (isAssistantLoading) {
    state = { kind: 'assistant-loading' };
  } else if (!isAssistantAvailable) {
    state = { kind: 'assistant-unavailable' };
  } else if (isGenerating) {
    state = { kind: 'working', context, stop };
  } else if (contextError) {
    state = { kind: 'context-error', retry: loadContext };
  } else if (error) {
    state = { kind: 'error', error, retry: error.retryable ? () => setError(undefined) : undefined };
  } else if (showIterationNudge) {
    state = {
      kind: 'iteration-nudge',
      continueHere: () => setIterationNudgeDismissed(true),
      continueInAssistant: () => continueInAssistant('iteration_nudge'),
    };
  } else if (fallback) {
    state = {
      kind: 'fallback',
      fallback,
      continueInAssistant: (reason) => continueInAssistant('fallback', reason),
      setFeedback,
    };
  } else if (proposal) {
    state = {
      kind: 'proposal',
      isPreviewRunning,
      proposal,
      accept,
      continueInAssistant: () => continueInAssistant('proposal'),
      setFeedback,
    };
  } else {
    state = {
      kind: 'prompt',
      clarification,
      context,
      intent,
      isIdentifying,
      promptUserGestureRef,
      selectionExplanation,
      submittedIterationCount,
      continueInAssistant: () => continueInAssistant('clarification', clarification?.message),
      setIntent,
      submit: () => void submit(),
    };
  }

  return { closeFeedback, dismiss: dismissPopover, feedback, state };
}
