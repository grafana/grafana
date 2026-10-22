import { type PanelData } from '@grafana/data';

import { type QueryCoauthoringFeedbackState } from './QueryCoauthoringFeedback';
import { type QueryEditorCoauthoringContextV1 } from './internalCoauthoringContract';
import {
  reduceQueryCoauthoringGroup,
  type QueryCoauthoringGroupEvent,
  type QueryCoauthoringGroupState,
} from './queryCoauthoringGroupLayout';
import {
  findQueryCoauthoringMention,
  queryCoauthoringMentionOptions,
  type QueryCoauthoringMention,
} from './queryCoauthoringMentions';
import { classifyQueryPreview } from './queryCoauthoringPreviewOutcome';
import { type QueryExplanation } from './queryCoauthoringPrompts';
import { type QueryCoauthoringRequestError, type QueryCoauthoringRequestOutcome } from './queryCoauthoringRequest';
import { type QueryCoauthoringSessionState } from './useQueryCoauthoringSession';

type SessionAction =
  | 'accept'
  | 'selectOption'
  | 'peek'
  | 'stopPeek'
  | 'continueHere'
  | 'continueInAssistant'
  | 'retry'
  | 'setFeedback'
  | 'setIntent'
  | 'stop'
  | 'submit'
  | 'promptUserGestureRef'
  | 'explain'
  | 'exploreSimilar'
  | 'modify'
  | 'submitFollowUp';

type SessionSnapshot<T = QueryCoauthoringSessionState> = T extends QueryCoauthoringSessionState
  ? Omit<T, SessionAction> &
      (T['kind'] extends 'assistant-loading' | 'assistant-unavailable' | 'working' | 'context-error' | 'error'
        ? { resume: SessionSnapshot }
        : {})
  : never;
type PromptSnapshot = Extract<SessionSnapshot, { kind: 'prompt' }>;

interface SessionData extends QueryCoauthoringGroupState {
  engaged: boolean;
  prompt: PromptSnapshot;
  feedback?: QueryCoauthoringFeedbackState;
  submittedIntents: string[];
  iterationNudgeDismissed: boolean;
  requestId: number;
  isPreviewRunning: boolean;
  activeRequestId?: number;
  requestMode?: 'modify' | 'explain';
  requestResume?: SessionSnapshot;
  mention?: QueryCoauthoringMention;
  closedMentionFrom?: number;
  cursorPosition?: number;
}

export type QueryCoauthoringReducerState = SessionSnapshot & { data: SessionData };
export type QueryCoauthoringSessionEvent =
  | QueryCoauthoringGroupEvent
  | { type: 'assistant-loading' }
  | { type: 'assistant-unavailable' }
  | { type: 'assistant-ready' }
  | { type: 'invocation-cleared' }
  | { type: 'request-invalidated' }
  | { type: 'intent-changed'; intent: string; caret?: number }
  | { type: 'mention-caret-changed'; caret: number }
  | { type: 'mention-moved'; direction: 1 | -1 }
  | { type: 'mention-selected'; index?: number }
  | { type: 'mention-closed' }
  | { type: 'feedback-changed'; feedback?: QueryCoauthoringFeedbackState }
  | { type: 'option-selected'; index: number; previewData?: PanelData }
  | { type: 'preview-data-changed'; previewData?: PanelData }
  | { type: 'peek-started'; index: number }
  | { type: 'peek-stopped'; previewData?: PanelData }
  | {
      type: 'invocation-updated';
      context?: QueryEditorCoauthoringContextV1;
    }
  | { type: 'context-failed' }
  | { type: 'context-retried' }
  | { type: 'submission-started'; mode: 'modify' | 'explain'; intent: string }
  | { type: 'submission-ready'; requestId: number; intent: string }
  | { type: 'generation-started' }
  | { type: 'generation-settled'; error: QueryCoauthoringRequestError }
  | { type: 'generation-stopped' }
  | { type: 'follow-up-changed'; intent: string; caret?: number }
  | { type: 'modify-started' }
  | {
      type: 'explanation-completed';
      requestId: number;
      context: QueryEditorCoauthoringContextV1;
      answer: QueryExplanation;
    }
  | {
      type: 'request-completed';
      requestId: number;
      context: QueryEditorCoauthoringContextV1;
      outcome: QueryCoauthoringRequestOutcome;
    }
  | { type: 'preview-failed'; error: QueryCoauthoringRequestError }
  | { type: 'accept-failed'; error: QueryCoauthoringRequestError }
  | { type: 'error-retried' }
  | { type: 'iteration-continued' }
  | { type: 'preview-running-changed'; isPreviewRunning: boolean };

type QueryCoauthoringAssistantStatus = 'loading' | 'unavailable' | 'ready';

export function createQueryCoauthoringSessionState(
  assistantStatus: QueryCoauthoringAssistantStatus = 'ready'
): QueryCoauthoringReducerState {
  const prompt: PromptSnapshot = { kind: 'prompt', intent: '', submittedModifyCount: 0 };
  const state = {
    ...prompt,
    data: {
      engaged: false,
      prompt,
      submittedIntents: [],
      iterationNudgeDismissed: false,
      requestId: 0,
      isPreviewRunning: false,
    },
  };
  return assistantStatus === 'ready'
    ? state
    : transition(state, { kind: `assistant-${assistantStatus}`, resume: prompt });
}

function transition(state: QueryCoauthoringReducerState, view: SessionSnapshot): QueryCoauthoringReducerState {
  return { ...view, data: view.kind === 'prompt' ? { ...state.data, prompt: view } : state.data };
}

// Temporary views retain the session they cover, so settling generation or retrying
// a failed Accept restores the same proposal rather than reconstructing it from flags.
function updateSession(
  view: SessionSnapshot,
  update: (view: SessionSnapshot) => SessionSnapshot,
  through: 'assistant' | 'working' | 'context-error' | 'error' | 'request' = 'context-error'
): SessionSnapshot {
  switch (view.kind) {
    case 'error':
      if (through !== 'error') {
        return update(view);
      }
      break;
    case 'context-error':
      if (through === 'assistant' || through === 'working') {
        return update(view);
      }
      break;
    case 'working':
      if (through === 'assistant' || through === 'request') {
        return update(view);
      }
      break;
    case 'assistant-loading':
    case 'assistant-unavailable':
      break;
    default:
      return update(view);
  }
  return { ...view, resume: updateSession(view.resume, update, through) };
}

export function isCurrentQueryCoauthoringRequest(state: QueryCoauthoringReducerState, requestId: number): boolean {
  return state.data.activeRequestId === requestId;
}

export function queryCoauthoringSessionReducer(
  state: QueryCoauthoringReducerState,
  event: QueryCoauthoringSessionEvent
): QueryCoauthoringReducerState {
  const { data: _data, ...current } = state;
  switch (event.type) {
    case 'group-layout-frozen':
    case 'group-pointer-started':
    case 'group-pointer-moved':
    case 'group-pointer-ended':
    case 'group-viewport-changed':
    case 'group-adjustment-reported': {
      const data = reduceQueryCoauthoringGroup(state.data, event);
      return data === state.data ? state : { ...state, data };
    }

    case 'assistant-loading':
    case 'assistant-unavailable': {
      const resume =
        state.kind === 'assistant-loading' || state.kind === 'assistant-unavailable' ? state.resume : current;
      return transition(state, { kind: event.type, resume });
    }
    case 'assistant-ready':
      return state.kind === 'assistant-loading' || state.kind === 'assistant-unavailable'
        ? transition(state, state.resume)
        : state;
    case 'invocation-cleared': {
      const next = createQueryCoauthoringSessionState();
      next.data.requestId = state.data.requestId + 1;
      return transition(
        next,
        updateSession(current, () => next.data.prompt, 'working')
      );
    }
    case 'request-invalidated':
      return { ...state, data: { ...state.data, requestId: state.data.requestId + 1, activeRequestId: undefined } };
    case 'intent-changed': {
      const prompt = { ...state.data.prompt, intent: event.intent };
      const next = {
        ...state,
        data: {
          ...state.data,
          prompt,
          mention: event.caret === undefined ? undefined : findQueryCoauthoringMention(event.intent, event.caret),
          closedMentionFrom: undefined,
          cursorPosition: undefined,
        },
      };
      return transition(
        next,
        updateSession(current, (view) => (view.kind === 'prompt' ? prompt : view))
      );
    }
    case 'feedback-changed':
      return { ...state, data: { ...state.data, feedback: event.feedback } };
    case 'mention-closed':
      return {
        ...state,
        data: {
          ...state.data,
          closedMentionFrom: state.data.mention?.from ?? state.data.closedMentionFrom,
          mention: undefined,
        },
      };
    case 'mention-caret-changed': {
      if (state.kind !== 'prompt' && state.kind !== 'explain') {
        return state;
      }
      const mention = findQueryCoauthoringMention(state.intent, event.caret);
      // React can emit selection after Escape keyup without changing the mention token.
      if (state.data.closedMentionFrom !== undefined && mention?.from === state.data.closedMentionFrom) {
        return state;
      }
      const previous = state.data.mention;
      if (
        state.data.closedMentionFrom === undefined &&
        mention?.from === previous?.from &&
        mention?.to === previous?.to &&
        mention?.query === previous?.query
      ) {
        return state;
      }
      return { ...state, data: { ...state.data, mention, closedMentionFrom: undefined, cursorPosition: undefined } };
    }
    case 'mention-moved': {
      if (!state.data.mention || (state.kind !== 'prompt' && state.kind !== 'explain')) {
        return state;
      }
      const count = queryCoauthoringMentionOptions(state.context, state.data.mention.query).length;
      if (!count) {
        return state;
      }
      return {
        ...state,
        data: {
          ...state.data,
          mention: {
            ...state.data.mention,
            selectedIndex: (state.data.mention.selectedIndex + event.direction + count) % count,
          },
        },
      };
    }
    case 'mention-selected': {
      const mention = state.data.mention;
      if (!mention || (state.kind !== 'prompt' && state.kind !== 'explain')) {
        return state;
      }
      const option = queryCoauthoringMentionOptions(state.context, mention.query)[event.index ?? mention.selectedIndex];
      if (!option) {
        return state;
      }
      const prefix = state.intent.slice(0, mention.from) + option.name;
      const suffix = state.intent.slice(mention.to);
      const separator = /^\s/.test(suffix) ? '' : ' ';
      const intent = prefix + separator + suffix;
      const next = {
        ...state,
        data: {
          ...state.data,
          mention: undefined,
          closedMentionFrom: undefined,
          cursorPosition: prefix.length + separator.length,
        },
      };
      return transition(
        next,
        updateSession(current, (view) =>
          view.kind === 'prompt' || view.kind === 'explain' ? { ...view, intent } : view
        )
      );
    }
    case 'invocation-updated': {
      const prompt = {
        ...state.data.prompt,
        context: event.context,
      };
      const next = { ...state, data: { ...state.data, prompt } };
      return transition(
        next,
        updateSession(current, (view) => (view.kind === 'prompt' ? prompt : view))
      );
    }
    case 'context-failed':
      return transition(
        state,
        updateSession(
          current,
          (view) => (view.kind === 'context-error' ? view : { kind: 'context-error', resume: view }),
          'working'
        )
      );
    case 'context-retried':
      return transition(
        state,
        updateSession(current, (view) => (view.kind === 'context-error' ? view.resume : view), 'working')
      );
    case 'submission-started': {
      const requestId = state.data.requestId + 1;
      const requestResume = updateSession(current, (view) =>
        view.kind === 'prompt' || view.kind === 'explain' ? { ...view, intent: event.intent } : view
      );
      return {
        ...state,
        data: {
          ...state.data,
          engaged: true,
          requestId,
          activeRequestId: requestId,
          requestMode: event.mode,
          requestResume,
          mention: undefined,
          closedMentionFrom: undefined,
          cursorPosition: undefined,
        },
      };
    }
    case 'submission-ready': {
      if (!isCurrentQueryCoauthoringRequest(state, event.requestId)) {
        return state;
      }
      if (state.data.requestMode === 'explain') {
        return transition(
          state,
          updateSession(current, () => ({
            kind: 'working',
            mode: 'explain',
            context: state.data.prompt.context,
            resume: state.data.requestResume ?? state.data.prompt,
          }))
        );
      }
      const prompt = {
        ...state.data.prompt,
        clarification: undefined,
        submittedModifyCount: state.data.prompt.submittedModifyCount + 1,
      };
      const next = {
        ...state,
        data: { ...state.data, prompt, submittedIntents: [...state.data.submittedIntents, event.intent] },
      };
      return transition(
        next,
        updateSession(current, () => prompt)
      );
    }
    case 'generation-started':
      if (state.data.activeRequestId === undefined) {
        return state;
      }
      return transition(
        state,
        updateSession(
          current,
          (view) =>
            view.kind === 'working'
              ? view
              : {
                  kind: 'working',
                  context: state.data.prompt.context,
                  mode: state.data.requestMode ?? 'modify',
                  resume: view,
                },
          'assistant'
        )
      );
    case 'generation-settled':
      if (state.data.activeRequestId !== undefined) {
        if (state.data.requestMode !== 'explain') {
          return state;
        }
        return transition(
          { ...state, data: { ...state.data, activeRequestId: undefined } },
          updateSession(
            current,
            () => ({
              kind: 'error',
              error: event.error,
              resume: state.data.requestResume ?? state.data.prompt,
            }),
            'request'
          )
        );
      }
      return transition(
        state,
        updateSession(current, (view) => (view.kind === 'working' ? view.resume : view), 'assistant')
      );
    case 'generation-stopped': {
      const next = {
        ...state,
        data: {
          ...state.data,
          requestId: state.data.requestId + 1,
          activeRequestId: undefined,
        },
      };
      const previousView = state.data.requestResume ?? next.data.prompt;
      const resume =
        previousView.kind === 'prompt'
          ? { ...previousView, submittedModifyCount: next.data.prompt.submittedModifyCount }
          : previousView;
      return transition(
        next,
        updateSession(current, () => resume, 'request')
      );
    }
    case 'follow-up-changed':
      return transition(
        {
          ...state,
          data: {
            ...state.data,
            mention: event.caret === undefined ? undefined : findQueryCoauthoringMention(event.intent, event.caret),
            closedMentionFrom: undefined,
            cursorPosition: undefined,
          },
        },
        updateSession(current, (view) => (view.kind === 'explain' ? { ...view, intent: event.intent } : view))
      );
    case 'modify-started': {
      const prompt = { ...state.data.prompt, intent: '', clarification: undefined };
      return transition(
        {
          ...state,
          data: { ...state.data, prompt, mention: undefined, closedMentionFrom: undefined, cursorPosition: undefined },
        },
        updateSession(current, () => prompt)
      );
    }
    case 'explanation-completed': {
      if (!isCurrentQueryCoauthoringRequest(state, event.requestId)) {
        return state;
      }
      return transition(
        { ...state, data: { ...state.data, activeRequestId: undefined } },
        updateSession(
          current,
          () => ({
            kind: 'explain',
            context: event.context,
            answer: event.answer,
            intent: '',
          }),
          'request'
        )
      );
    }
    case 'request-completed': {
      if (!isCurrentQueryCoauthoringRequest(state, event.requestId) || event.outcome.status === 'ignored') {
        return state;
      }
      const next = { ...state, data: { ...state.data, activeRequestId: undefined } };
      let view: SessionSnapshot;
      switch (event.outcome.status) {
        case 'clarification': {
          const prompt = { ...state.data.prompt, intent: '', clarification: { message: event.outcome.message } };
          next.data.prompt = prompt;
          view =
            prompt.submittedModifyCount >= 3 && !state.data.iterationNudgeDismissed && prompt.context
              ? { kind: 'iteration-nudge' }
              : prompt;
          break;
        }
        case 'fallback':
          view = { kind: 'fallback', fallback: { ...event.outcome.fallback, context: event.context } };
          break;
        case 'error':
          view = {
            kind: 'error',
            error: event.outcome.error,
            resume:
              state.data.requestMode === 'explain'
                ? (state.data.requestResume ?? state.data.prompt)
                : state.data.prompt,
          };
          break;
        case 'proposal':
          view = {
            kind: 'proposal',
            previewOutcome: { kind: 'loading' },
            isPreviewRunning: state.data.isPreviewRunning,
            proposal: { options: event.outcome.options, selectedIndex: 0, context: event.context },
          };
      }
      return transition(
        next,
        updateSession(current, () => view, state.data.requestMode === 'explain' ? 'request' : 'context-error')
      );
    }
    case 'option-selected':
      return transition(
        state,
        updateSession(current, (view) =>
          view.kind === 'proposal' && event.index >= -1 && event.index < view.proposal.options.length
            ? {
                ...view,
                peekIndex: undefined,
                previewOutcome: classifyQueryPreview(event.previewData, view.proposal.options[0].prepared.query.refId),
                proposal: { ...view.proposal, selectedIndex: event.index },
              }
            : view
        )
      );
    case 'peek-started':
      return transition(
        state,
        updateSession(current, (view) =>
          view.kind === 'proposal' && event.index >= -1 && event.index < view.proposal.options.length
            ? { ...view, peekIndex: event.index }
            : view
        )
      );
    case 'peek-stopped':
      return transition(
        state,
        updateSession(current, (view) =>
          view.kind === 'proposal' && view.peekIndex !== undefined
            ? {
                ...view,
                peekIndex: undefined,
                previewOutcome: classifyQueryPreview(event.previewData, view.proposal.options[0].prepared.query.refId),
              }
            : view
        )
      );
    case 'preview-data-changed':
      return transition(
        state,
        updateSession(
          current,
          (view) =>
            view.kind === 'proposal' && view.peekIndex === undefined
              ? {
                  ...view,
                  previewOutcome: classifyQueryPreview(
                    event.previewData,
                    view.proposal.options[0].prepared.query.refId
                  ),
                }
              : view,
          'error'
        )
      );
    case 'preview-failed':
      return transition(
        state,
        updateSession(current, () => ({ kind: 'error', error: event.error, resume: state.data.prompt }))
      );
    case 'accept-failed':
      return transition(
        state,
        updateSession(current, (view) => ({ kind: 'error', error: event.error, resume: view }))
      );
    case 'error-retried':
      return transition(
        state,
        updateSession(current, (view) => (view.kind === 'error' ? view.resume : view))
      );
    case 'iteration-continued': {
      const next = { ...state, data: { ...state.data, iterationNudgeDismissed: true } };
      return transition(
        next,
        updateSession(current, () => state.data.prompt)
      );
    }
    case 'preview-running-changed': {
      const next = { ...state, data: { ...state.data, isPreviewRunning: event.isPreviewRunning } };
      return transition(
        next,
        updateSession(
          current,
          (view) => (view.kind === 'proposal' ? { ...view, isPreviewRunning: event.isPreviewRunning } : view),
          'error'
        )
      );
    }
  }
}
