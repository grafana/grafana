import { buildAgentPromptDeeplink, openAgentPromptDeeplink } from './deeplinks';

describe('buildAgentPromptDeeplink', () => {
  it('uses the native scheme and never a vendor web redirector', () => {
    // The whole reason for the native scheme: the prompt must not reach a third
    // party's request logs on its way to an app on this machine.
    const cursor = buildAgentPromptDeeplink('cursor', '# Panel');
    const claude = buildAgentPromptDeeplink('claude', '# Panel');

    expect(cursor.startsWith('cursor://anysphere.cursor-deeplink/prompt')).toBe(true);
    expect(cursor).not.toContain('cursor.com');
    expect(claude.startsWith('claude://code/new')).toBe(true);
    expect(claude).not.toContain('claude.com');
  });

  it.each([
    { agent: 'cursor' as const, param: 'text' },
    { agent: 'claude' as const, param: 'q' },
  ])('carries the prompt url-encoded in $agent’s $param parameter', ({ agent, param }) => {
    const url = buildAgentPromptDeeplink(agent, 'a b&c=d');

    expect(new URL(url).searchParams.get(param)).toBe('a b&c=d');
  });

  it('targets the Claude surface that can draw a panel, not the terminal', () => {
    // claude-cli:// opens a terminal, which renders no MCP App and falls back to text.
    // The desktop app's claude:// scheme is the one that draws the panel.
    expect(buildAgentPromptDeeplink('claude', 'x')).not.toContain('claude-cli');
  });

  it('leaves a prompt that already fits untouched', () => {
    const prompt = 'Show me the "p95 latency" panel';

    expect(new URL(buildAgentPromptDeeplink('cursor', prompt)).searchParams.get('text')).toBe(prompt);
  });

  it('truncates against the url length for Cursor, and says it truncated', () => {
    const url = buildAgentPromptDeeplink('cursor', 'x'.repeat(20000));

    expect(url.length).toBeLessThanOrEqual(8000);
    expect(new URL(url).searchParams.get('text')).toContain('[truncated to fit the deep link limit]');
  });

  it('accounts for url encoding cost when truncating against a url limit', () => {
    // A newline encodes to three characters, so a fixed character cut would overshoot.
    const url = buildAgentPromptDeeplink('cursor', '\n'.repeat(20000));

    expect(url.length).toBeLessThanOrEqual(8000);
  });

  it('truncates against the prompt length for Claude Code, not the url length', () => {
    const url = buildAgentPromptDeeplink('claude', '\n'.repeat(20000));
    const prompt = new URL(url).searchParams.get('q') ?? '';

    // Claude documents a 5,000-character limit on the prompt itself. Counting the url
    // instead would cut this to roughly a third of what it accepts, which is what the
    // second assertion pins: the url is allowed to be far longer than the limit.
    expect(Array.from(prompt).length).toBeLessThanOrEqual(5000);
    expect(Array.from(prompt).length).toBeGreaterThan(4900);
    expect(url.length).toBeGreaterThan(5000);
  });

  it('does not cut an emoji in half when truncating', () => {
    // `slice` counts UTF-16 code units, so a cut can orphan half a surrogate pair; url
    // encoding then substitutes U+FFFD rather than throwing. The short prefix is what
    // puts the limit inside that window - with no prefix the search settles on a pair
    // boundary by itself and the test proves nothing.
    const url = buildAgentPromptDeeplink('cursor', 'latenc' + '\u{1F600}'.repeat(3000));

    expect(new URL(url).searchParams.get('text') ?? '').not.toContain('�');
  });
});

describe('openAgentPromptDeeplink', () => {
  it('navigates the given window to the deep link', () => {
    const win = { location: { href: '' } };

    openAgentPromptDeeplink('claude', '# Panel', win as unknown as Window);

    expect(win.location.href.startsWith('claude://code/new?q=')).toBe(true);
  });
});
