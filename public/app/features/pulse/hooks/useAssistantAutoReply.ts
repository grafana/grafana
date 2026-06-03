import { useCallback } from 'react';

import { useAssistant, useInlineAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';

import { useAddAssistantReplyMutation } from '../api/pulseApi';
import { type PulseBody } from '../types';
import { bodyToText, collectMentions } from '../utils/body';

/** Origin string for Assistant analytics — namespaced per the package's
 *  convention (`<namespace>/<surface>`). */
const ASSISTANT_REPLY_ORIGIN = 'grafana/pulse/assistant-reply';

export interface AssistantReplyContext {
  threadUID: string;
  /** The pulse that tagged the assistant; the reply threads under it. */
  parentUID?: string;
}

/** bodyTagsAssistant reports whether a composed body contains an
 *  `@assistant` mention — the trigger for an auto-reply. */
export function bodyTagsAssistant(body: PulseBody): boolean {
  return collectMentions(body).some((m) => m.kind === 'assistant');
}

/**
 * useAssistantAutoReply returns a function to call after a pulse is posted.
 * When that pulse tagged `@assistant`, it asks the Grafana Assistant (via
 * the package's inline generation API — the same backend the sidebar chat
 * uses) to answer, then posts the answer into the thread as the assistant
 * service account.
 *
 * Generation is intentionally client-side: Grafana's backend has no LLM, so
 * the assistant answer is produced in the browser and persisted through the
 * `assistant-reply` endpoint. The whole thing is best-effort — failures and
 * an unavailable assistant degrade to a short fallback notice rather than
 * surfacing an error over the user's own (already successful) pulse.
 */
export function useAssistantAutoReply(): (body: PulseBody, ctx: AssistantReplyContext) => Promise<void> {
  const { isAvailable } = useAssistant();
  const { generate } = useInlineAssistant();
  const [addAssistantReply] = useAddAssistantReplyMutation();

  return useCallback(
    async (body: PulseBody, ctx: AssistantReplyContext): Promise<void> => {
      if (!bodyTagsAssistant(body)) {
        return;
      }

      // Post exactly once across the streaming success path, the error
      // callback, and the throw path.
      let posted = false;
      const postOnce = (markdown: string) => {
        const trimmed = markdown.trim();
        if (posted || trimmed.length === 0) {
          return;
        }
        posted = true;
        addAssistantReply({ threadUID: ctx.threadUID, req: { parentUID: ctx.parentUID, markdown: trimmed } })
          .unwrap()
          .catch(() => {
            // best-effort — the user's pulse already landed.
          });
      };

      if (!isAvailable) {
        postOnce(assistantUnavailableMessage());
        return;
      }

      try {
        await generate({
          prompt: buildPrompt(body),
          origin: ASSISTANT_REPLY_ORIGIN,
          systemPrompt: assistantSystemPrompt(),
          onComplete: (text) => postOnce(text),
          onError: () => postOnce(assistantUnavailableMessage()),
        });
      } catch {
        postOnce(assistantUnavailableMessage());
      }
    },
    [isAvailable, generate, addAssistantReply]
  );
}

/** buildPrompt turns the tagging pulse into the assistant prompt, stripping
 *  the `@assistant` chip text so the model sees just the question. */
function buildPrompt(body: PulseBody): string {
  let text = bodyToText(body);
  for (const m of collectMentions(body)) {
    if (m.kind === 'assistant') {
      text = text.split('@' + (m.displayName ?? m.targetId)).join(' ');
    }
  }
  text = text.trim();
  return text.length > 0 ? text : t('pulse.assistant.empty-prompt', 'Please help with this dashboard conversation.');
}

function assistantSystemPrompt(): string {
  return t(
    'pulse.assistant.system-prompt',
    'You are the Grafana Assistant replying inside a dashboard conversation thread. Answer concisely and helpfully in Markdown.'
  );
}

function assistantUnavailableMessage(): string {
  return t(
    'pulse.assistant.unavailable',
    "I'm the Grafana Assistant, but I'm not available in this Grafana instance right now, so I can't answer here."
  );
}
