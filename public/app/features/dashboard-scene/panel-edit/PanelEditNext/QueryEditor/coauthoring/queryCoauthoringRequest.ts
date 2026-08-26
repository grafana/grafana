import { createTool } from '@grafana/assistant';

import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringProposalResultV1,
} from './internalCoauthoringContract';
import {
  buildInvalidProposalRepairMessage,
  buildProposalToolDescription,
  invalidQueryResponseMessage,
  MAX_INLINE_CLARIFICATION_RESPONSE_LENGTH,
  multipleResponsesMessage,
  normalizeClarificationMessage,
  type QueryFallback,
  type QueryProposal,
  requestFailedMessage,
  staleQueryResponseMessage,
  unchangedQueryResponseMessage,
  validateFallback,
  validateProposal,
} from './queryCoauthoringPrompts';

type PreparedQuery = Extract<QueryEditorCoauthoringProposalResultV1, { status: 'ready' }>;
const MAX_INVALID_PROPOSAL_REPAIR_ATTEMPTS = 1;

export interface QueryCoauthoringRequestError {
  message: string;
  retryable: boolean;
}

export type QueryCoauthoringRequestOutcome =
  | { status: 'ignored' }
  | { status: 'clarification'; message: string }
  | { status: 'fallback'; fallback: QueryFallback }
  | { status: 'proposal'; proposal: QueryProposal; prepared: PreparedQuery }
  | { status: 'error'; error: QueryCoauthoringRequestError };

interface QueryCoauthoringRequestOptions {
  adapter: QueryEditorCoauthoringAdapterV1;
  invocationId: string;
  context: QueryEditorCoauthoringContextV1;
  isCurrent: () => boolean;
}

export function createQueryCoauthoringRequest({
  adapter,
  invocationId,
  context,
  isCurrent,
}: QueryCoauthoringRequestOptions) {
  let submittedProposal: QueryProposal | undefined;
  let submittedPrepared: PreparedQuery | undefined;
  let submittedFallback: QueryFallback | undefined;
  let rejectedTerminalProposal: 'unchanged' | 'stale' | undefined;
  let acceptedTerminalToolCallCount = 0;
  let rejectedInvalidProposalCount = 0;
  let invalidProposalRepairExhausted = false;
  let terminalCallbackHandled = false;

  const proposalTool = createTool(
    async (input: QueryProposal) => {
      if (isCurrent()) {
        if (invalidProposalRepairExhausted) {
          return 'The query proposal is invalid and no further repair attempts are available.';
        }
        const prepared = adapter.prepareProposal(invocationId, input.proposedQuery);
        if (prepared.status !== 'ready') {
          if (prepared.reason === 'invalid') {
            rejectedInvalidProposalCount++;
            if (rejectedInvalidProposalCount <= MAX_INVALID_PROPOSAL_REPAIR_ATTEMPTS) {
              throw new Error(buildInvalidProposalRepairMessage(context));
            }
            invalidProposalRepairExhausted = true;
            return 'The query proposal is invalid and no further repair attempts are available.';
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
      description: buildProposalToolDescription(context),
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
      if (isCurrent()) {
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

  const complete = (completionText: string): QueryCoauthoringRequestOutcome => {
    if (!isCurrent() || terminalCallbackHandled) {
      return { status: 'ignored' };
    }
    terminalCallbackHandled = true;
    if (acceptedTerminalToolCallCount === 0) {
      if (invalidProposalRepairExhausted) {
        return { status: 'error', error: { message: invalidQueryResponseMessage(context), retryable: true } };
      }
      const message = normalizeClarificationMessage(completionText);
      if (message) {
        return message.length > MAX_INLINE_CLARIFICATION_RESPONSE_LENGTH
          ? { status: 'fallback', fallback: { reason: message.slice(0, 500) } }
          : { status: 'clarification', message };
      }
      return rejectedInvalidProposalCount > 0
        ? { status: 'error', error: { message: invalidQueryResponseMessage(context), retryable: true } }
        : { status: 'error', error: { message: requestFailedMessage(), retryable: true } };
    }
    if (acceptedTerminalToolCallCount !== 1) {
      return { status: 'error', error: { message: multipleResponsesMessage(), retryable: true } };
    }
    if (rejectedTerminalProposal) {
      return {
        status: 'error',
        error: {
          message: rejectedTerminalProposal === 'stale' ? staleQueryResponseMessage() : unchangedQueryResponseMessage(),
          retryable: rejectedTerminalProposal === 'unchanged',
        },
      };
    }
    if (submittedFallback) {
      return { status: 'fallback', fallback: submittedFallback };
    }
    if (submittedProposal && submittedPrepared) {
      return { status: 'proposal', proposal: submittedProposal, prepared: submittedPrepared };
    }
    return { status: 'error', error: { message: invalidQueryResponseMessage(context), retryable: true } };
  };

  const fail = (): QueryCoauthoringRequestOutcome => {
    if (!isCurrent() || terminalCallbackHandled) {
      return { status: 'ignored' };
    }
    terminalCallbackHandled = true;
    return { status: 'error', error: { message: requestFailedMessage(), retryable: true } };
  };

  return { complete, fail, tools: [proposalTool, fallbackTool] };
}
