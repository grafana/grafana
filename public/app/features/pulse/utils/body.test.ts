import { type PulseBody, type PulseMention } from '../types';

import { bodyToText, isAtMention, mentionMarkdownToken } from './body';

describe('body mention prefixes', () => {
  it('treats user, time, assistant, and webhook kinds as @-mentions', () => {
    expect(isAtMention('user')).toBe(true);
    expect(isAtMention('time')).toBe(true);
    expect(isAtMention('assistant')).toBe(true);
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

describe('mentionMarkdownToken', () => {
  it('prefixes assistant mentions with @ (same trigger the author typed)', () => {
    expect(mentionMarkdownToken({ kind: 'assistant', targetId: 'assistant', displayName: 'Grafana Assistant' })).toBe(
      '`@Grafana Assistant`'
    );
  });

  it('prefixes user/time mentions with @ and resource mentions with #', () => {
    expect(mentionMarkdownToken({ kind: 'user', targetId: '7', displayName: 'alice' })).toBe('`@alice`');
    expect(mentionMarkdownToken({ kind: 'panel', targetId: '3', displayName: 'Latency' })).toBe('`#Latency`');
    expect(mentionMarkdownToken({ kind: 'dashboard', targetId: 'abc', displayName: 'Dash' })).toBe('`#Dash`');
  });
});

describe('bodyToText', () => {
  it('renders an assistant mention with the @ prefix in the plain-text projection', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'hey ' },
              {
                type: 'mention',
                mention: { kind: 'assistant', targetId: 'assistant', displayName: 'Grafana Assistant' },
              },
            ],
          },
        ],
      },
    };
    expect(bodyToText(body)).toBe('hey @Grafana Assistant');
  });
});
