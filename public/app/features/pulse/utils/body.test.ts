import { type PulseBody } from '../types';

import { bodyToText, mentionMarkdownToken } from './body';

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
