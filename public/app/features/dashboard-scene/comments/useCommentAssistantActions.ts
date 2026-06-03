import { useCallback, useEffect, useState } from 'react';

import { useInlineAssistant } from '@grafana/assistant';
import { isAssistantAvailable } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';

import { getAssistantChat, recordAssistantChatTurn } from './assistantChatRegistry';
import { buildCommentAssistantContext, type CommentAssistantPinContext } from './commentAssistant';
import { hasAssistantMention, hasChatMention, parseCommentMentions } from './mentions';
import { type CommentThread } from './types';

const ASSISTANT_SYSTEM_PROMPT =
  'You are Grafana Assistant participating in a dashboard comment thread. ' +
  'Answer concisely in plain text suitable as a comment reply. ' +
  'Investigate the panel and time range when helpful. Do not use markdown headings.';

const CHAT_SUMMARY_SYSTEM_PROMPT =
  'You are Grafana Assistant. Summarize the provided assistant conversation for teammates in a dashboard comment. ' +
  'Use 2-4 short paragraphs. Focus on conclusions, data findings, and open questions. Plain text only.';

export interface ProcessCommentMentionsOptions {
  pin: CommentAssistantPinContext;
  thread: CommentThread;
  rawBody: string;
  generate: ReturnType<typeof useInlineAssistant>['generate'];
  appendUserMessage: (body: string) => Promise<unknown>;
  appendAssistantMessage: (body: string) => Promise<unknown>;
  /** When the user message was already persisted (e.g. new thread create). */
  skipUserMessage?: boolean;
}

export async function processCommentMentions({
  pin,
  thread,
  rawBody,
  generate,
  appendUserMessage,
  appendAssistantMessage,
  skipUserMessage = false,
}: ProcessCommentMentionsOptions): Promise<void> {
  const parsed = parseCommentMentions(rawBody);
  const displayBody = parsed.cleanBody || rawBody.trim();

  if (!displayBody && !parsed.assistantQuestion && !parsed.chatId && !parsed.chatMentionWithoutId) {
    return;
  }

  if (!skipUserMessage) {
    if (displayBody) {
      await appendUserMessage(displayBody);
    } else if (parsed.assistantQuestion || parsed.chatId || parsed.chatMentionWithoutId) {
      await appendUserMessage(rawBody.trim());
    }
  }

  const runGeneration = async (options: {
    origin: string;
    prompt: string;
    systemPrompt: string;
    userLabel: string;
    onResult: (text: string) => Promise<void>;
  }) => {
    const chatId = `comments-${thread.id}-${Date.now()}`;
    await new Promise<void>((resolve, reject) => {
      void generate({
        origin: options.origin,
        agentName: 'comment-thread',
        prompt: options.prompt,
        systemPrompt: options.systemPrompt,
        onComplete: (text) => {
          const trimmed = text.trim();
          if (!trimmed) {
            reject(new Error('empty assistant response'));
            return;
          }
          void options
            .onResult(trimmed)
            .then(() => {
              recordAssistantChatTurn(chatId, options.userLabel, options.prompt, trimmed);
              resolve();
            })
            .catch(reject);
        },
        onError: reject,
      });
    });
  };

  if (parsed.assistantQuestion) {
    reportInteraction('dashboards_comment_assistant_mentioned', {
      dashboard_uid: pin.dashboardUid,
      thread_id: thread.id,
      kind: 'assistant',
    });

    const threadContext = thread.messages
      .map((m) => `${m.author.name}: ${m.body}`)
      .concat(displayBody ? [`(latest) ${displayBody}`] : [])
      .join('\n');

    await runGeneration({
      origin: 'grafana/dashboard/comments/@assistant',
      userLabel: `Thread #${thread.id}`,
      systemPrompt: ASSISTANT_SYSTEM_PROMPT,
      prompt:
        `${parsed.assistantQuestion}\n\n` +
        `Panel: ${pin.panelTitle}\n` +
        `Time range: ${pin.timeRange.from} – ${pin.timeRange.to}\n\n` +
        `Comment thread:\n${threadContext}`,
      onResult: appendAssistantMessage,
    });
  }

  if (parsed.chatMentionWithoutId && !parsed.chatId) {
    await appendAssistantMessage(
      t(
        'dashboard-scene.comments-assistant.pick-chat',
        'Pick a recent Assistant chat from the @ menu (shown as @chat:ID), then send again.'
      )
    );
    return;
  }

  if (parsed.chatId) {
    const chat = getAssistantChat(parsed.chatId);
    if (!chat) {
      await appendAssistantMessage(
        t(
          'dashboard-scene.comments-assistant.chat-not-found',
          'Could not find that Assistant chat in this browser session. Open Assistant from comments first, or use @chat:ID from a recent chat.'
        )
      );
      return;
    }

    reportInteraction('dashboards_comment_assistant_mentioned', {
      dashboard_uid: pin.dashboardUid,
      thread_id: thread.id,
      kind: 'chat-summary',
      chat_id: parsed.chatId,
    });

    const transcript = chat.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
    await runGeneration({
      origin: 'grafana/dashboard/comments/@chat',
      userLabel: chat.title,
      systemPrompt: CHAT_SUMMARY_SYSTEM_PROMPT,
      prompt:
        `Summarize this Assistant conversation for a dashboard comment on panel "${pin.panelTitle}":\n\n` +
        transcript,
      onResult: appendAssistantMessage,
    });
  }
}

interface UseCommentAssistantActionsOptions {
  pin: CommentAssistantPinContext;
  thread: CommentThread;
  appendUserMessage: (body: string) => Promise<unknown>;
  appendAssistantMessage: (body: string) => Promise<unknown>;
}

export function useCommentAssistantActions({
  pin,
  thread,
  appendUserMessage,
  appendAssistantMessage,
}: UseCommentAssistantActionsOptions) {
  const { generate, isGenerating, cancel } = useInlineAssistant();
  const [assistantAvailable, setAssistantAvailable] = useState(false);

  useEffect(() => {
    const sub = isAssistantAvailable().subscribe(setAssistantAvailable);
    return () => sub.unsubscribe();
  }, []);

  const submitWithMentions = useCallback(
    async (rawBody: string) => {
      if (!assistantAvailable) {
        await appendUserMessage(rawBody.trim());
        return;
      }
      await processCommentMentions({
        pin,
        thread,
        rawBody,
        generate,
        appendUserMessage,
        appendAssistantMessage,
      });
    },
    [appendAssistantMessage, appendUserMessage, assistantAvailable, generate, pin, thread]
  );

  return {
    submitWithMentions,
    isGenerating,
    cancelGeneration: cancel,
    assistantAvailable,
    mentionsEnabled: assistantAvailable,
    detectMentions: (body: string) => hasAssistantMention(body) || hasChatMention(body),
    buildContext: () => buildCommentAssistantContext(pin, thread),
  };
}
