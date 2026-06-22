import { type PulseBody, type PulseMention } from '../types';

import { bodyToText, isAtMention, mentionMarkdownToken } from './body';

describe('body mention prefixes', () => {
  it('treats user, time, and webhook kinds as @-mentions', () => {
    expect(isAtMention('user')).toBe(true);
    expect(isAtMention('time')).toBe(true);
    expect(isAtMention('webhook')).toBe(true);
  });

  it('treats panel and dashboard kinds as #-mentions', () => {
    expect(isAtMention('panel')).toBe(false);
    expect(isAtMention('dashboard')).toBe(false);
  });

  it('writes a webhook mention token with an @ prefix like a user', () => {
    const hook: PulseMention = { kind: 'webhook', targetId: 'abc123', displayName: 'Grafana-P.S.' };
    expect(mentionMarkdownToken(hook)).toBe('`@Grafana-P.S.`');
  });

  it('extracts a webhook mention as @name in plain text', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'paging ' },
              { type: 'mention', mention: { kind: 'webhook', targetId: 'abc123', displayName: 'Grafana-P.S.' } },
            ],
          },
        ],
      },
    };
    expect(bodyToText(body)).toContain('@Grafana-P.S.');
  });
});
