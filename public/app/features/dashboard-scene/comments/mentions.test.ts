import { parseCommentMentions } from './mentions';

describe('parseCommentMentions', () => {
  it('extracts @assistant question', () => {
    const parsed = parseCommentMentions('@assistant why did latency spike?');
    expect(parsed.assistantQuestion).toContain('why did latency spike');
    expect(parsed.cleanBody).toBe('why did latency spike?');
  });

  it('extracts @chat id', () => {
    const parsed = parseCommentMentions('Please review @chat:abc-123 for context');
    expect(parsed.chatId).toBe('abc-123');
    expect(parsed.cleanBody).toContain('Please review');
  });

  it('flags bare @chat', () => {
    const parsed = parseCommentMentions('Summarize @chat please');
    expect(parsed.chatMentionWithoutId).toBe(true);
  });
});
