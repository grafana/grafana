export const ASSISTANT_MENTION_HANDLE = '@assistant';
export const CHAT_MENTION_PREFIX = '@chat';

export interface ParsedCommentMentions {
  /** Text with mention tokens removed, trimmed */
  cleanBody: string;
  /** Question for @assistant (undefined if not mentioned) */
  assistantQuestion?: string;
  /** Chat id from @chat:<id> (undefined if not mentioned) */
  chatId?: string;
  /** True when user wrote @chat without an id */
  chatMentionWithoutId: boolean;
}

const ASSISTANT_PATTERN = /@assistant\b/gi;
const CHAT_WITH_ID_PATTERN = /@chat:([a-zA-Z0-9-]+)\b/gi;
const CHAT_BARE_PATTERN = /@chat\b/gi;

export function parseCommentMentions(body: string): ParsedCommentMentions {
  let assistantQuestion: string | undefined;
  let chatId: string | undefined;
  let chatMentionWithoutId = false;

  const assistantMatch = body.match(ASSISTANT_PATTERN);
  if (assistantMatch) {
    assistantQuestion = body
      .replace(ASSISTANT_PATTERN, ' ')
      .replace(CHAT_WITH_ID_PATTERN, ' ')
      .replace(CHAT_BARE_PATTERN, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!assistantQuestion) {
      assistantQuestion = 'Please help with this dashboard comment thread.';
    }
  }

  const chatIdMatch = body.match(CHAT_WITH_ID_PATTERN);
  if (chatIdMatch) {
    const idCapture = /@chat:([a-zA-Z0-9-]+)\b/i.exec(body);
    chatId = idCapture?.[1];
  } else if (CHAT_BARE_PATTERN.test(body)) {
    chatMentionWithoutId = true;
  }

  const cleanBody = body
    .replace(ASSISTANT_PATTERN, ' ')
    .replace(CHAT_WITH_ID_PATTERN, ' ')
    .replace(CHAT_BARE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    cleanBody,
    assistantQuestion: assistantMatch ? assistantQuestion : undefined,
    chatId,
    chatMentionWithoutId,
  };
}

export function hasAssistantMention(body: string): boolean {
  return ASSISTANT_PATTERN.test(body);
}

export function hasChatMention(body: string): boolean {
  return CHAT_WITH_ID_PATTERN.test(body) || CHAT_BARE_PATTERN.test(body);
}
