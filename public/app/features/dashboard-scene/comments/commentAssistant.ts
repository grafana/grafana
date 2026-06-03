import { createAssistantContextItem, type ChatContextItem, type OpenAssistantProps } from '@grafana/assistant';

import { type CommentThread } from './types';

export interface CommentAssistantPinContext {
  dashboardUid: string;
  dashboardTitle?: string;
  panelKey: string;
  panelTitle: string;
  timeRange: { from: string; to: string };
}

export function buildCommentAssistantContext(
  pin: CommentAssistantPinContext,
  thread?: CommentThread
): ChatContextItem[] {
  const context: ChatContextItem[] = [];

  if (pin.dashboardUid) {
    context.push(
      createAssistantContextItem('dashboard', {
        dashboardUid: pin.dashboardUid,
        dashboardTitle: pin.dashboardTitle || pin.dashboardUid,
      })
    );
  }

  context.push(
    createAssistantContextItem('structured', {
      title: pin.panelTitle || 'Panel',
      data: {
        panelKey: pin.panelKey,
        panelTitle: pin.panelTitle,
        timeRange: pin.timeRange,
        ...(thread
          ? {
              threadId: thread.id,
              resolved: thread.resolved,
              messages: thread.messages.map((m) => ({
                author: m.author.name,
                body: m.body,
                createdAt: m.createdAt,
              })),
            }
          : {}),
      },
    })
  );

  return context;
}

export function buildCommentAssistantPrompt(pin: CommentAssistantPinContext, thread?: CommentThread): string {
  const panel = pin.panelTitle || 'this panel';
  const rangeLabel =
    pin.timeRange.from && pin.timeRange.to
      ? `time range ${pin.timeRange.from} to ${pin.timeRange.to}`
      : 'the current dashboard time range';

  if (thread) {
    const discussion = thread.messages.map((m) => `${m.author.name}: ${m.body}`).join('\n');
    return (
      `Help me investigate and respond to a dashboard comment thread on panel "${panel}" (${rangeLabel}). ` +
      `Review the panel data for that period, summarize what might explain the discussion, and suggest a concise reply.\n\n` +
      `Thread:\n${discussion}`
    );
  }

  return (
    `I'm adding a comment on panel "${panel}" at a specific point on the chart (${rangeLabel}). ` +
    `Help me investigate what the data shows at that moment so I can write an informed comment.`
  );
}

export function openCommentInAssistant(
  openAssistant: (props: OpenAssistantProps) => void,
  pin: CommentAssistantPinContext,
  options: { origin: string; thread?: CommentThread; autoSend?: boolean }
): void {
  const { origin, thread, autoSend = true } = options;

  openAssistant({
    origin,
    mode: 'assistant',
    prompt: buildCommentAssistantPrompt(pin, thread),
    context: buildCommentAssistantContext(pin, thread),
    autoSend,
  });
}
