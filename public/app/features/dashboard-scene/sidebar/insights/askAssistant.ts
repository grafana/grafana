import { ensureInlineAssistantInitialized, getInlineAssistantFactory } from '@grafana/assistant';
import { t } from '@grafana/i18n';

import { INSIGHT_ANSWER_SCHEMA, INSIGHT_SYSTEM_PROMPT } from './prompt';
import { type InsightSnapshot } from './types';

export const INSIGHTS_ORIGIN = 'grafana/dashboard/insights';

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException('Insight request cancelled', 'AbortError');
  }
}

/**
 * A fresh, tool-free inline assistant per ask, so answers never see chat history or other sources.
 * `systemPrompt` overrides the default rules; the Text panel's insight mode passes a variant that
 * carries the earlier answer so a follow-up does not repeat it.
 */
export function askInsightAssistant(
  snapshot: InsightSnapshot,
  signal: AbortSignal,
  systemPrompt: string = INSIGHT_SYSTEM_PROMPT
): Promise<string> {
  return sendInsightPrompt(snapshot, systemPrompt, INSIGHT_ANSWER_SCHEMA, signal);
}

/** Sends `input` as JSON under `systemPrompt`, with the same isolation as an insight question. */
export async function sendInsightPrompt(
  input: object,
  systemPrompt: string,
  responseSchema: object,
  signal: AbortSignal
): Promise<string> {
  await ensureInlineAssistantInitialized();
  throwIfAborted(signal);

  const assistant = await getInlineAssistantFactory()(INSIGHTS_ORIGIN);
  const onAbort = () => assistant.cancel();
  try {
    throwIfAborted(signal);
    signal.addEventListener('abort', onAbort, { once: true });

    // sendPrompt reports failures through onError and resolves either way.
    const outcome: { text?: string; error?: Error } = {};
    await assistant.sendPrompt({
      prompt: JSON.stringify(input),
      systemPrompt,
      agentName: 'dashboard-insights',
      tools: [],
      responseSchema,
      onComplete: (text) => {
        outcome.text = text;
      },
      onError: (error) => {
        outcome.error = error;
      },
    });

    // A cancelled request can still complete with partial text.
    throwIfAborted(signal);
    if (outcome.error) {
      throw outcome.error;
    }
    const text = outcome.text?.trim();
    if (!text) {
      throw new Error(t('dashboard.insights.ask.no-answer', 'Assistant returned no answer. Try asking again.'));
    }
    return text;
  } finally {
    signal.removeEventListener('abort', onAbort);
    assistant.dispose();
  }
}
