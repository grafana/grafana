import { buildCursorPromptDeeplink, openCursorPromptDeeplink } from './cursor';

describe('buildCursorPromptDeeplink', () => {
  it('uses the native scheme and never cursor.com', () => {
    // The whole point of the native scheme: notebook contents must not reach a third party's logs.
    const url = buildCursorPromptDeeplink('# Notebook');

    expect(url.startsWith('cursor://anysphere.cursor-deeplink/prompt')).toBe(true);
    expect(url).not.toContain('cursor.com');
  });

  it('carries the prompt url-encoded', () => {
    const url = buildCursorPromptDeeplink('a b&c');

    expect(new URL(url).searchParams.get('text')).toBe('a b&c');
  });

  it('keeps a long notebook under the deep link limit and says it truncated', () => {
    const url = buildCursorPromptDeeplink('x'.repeat(20000));

    expect(url.length).toBeLessThanOrEqual(8000);
    expect(new URL(url).searchParams.get('text')).toContain('[Notebook truncated to fit the Cursor deep link limit]');
  });

  it('leaves a notebook that already fits untouched', () => {
    const text = '# Small notebook';

    expect(new URL(buildCursorPromptDeeplink(text)).searchParams.get('text')).toBe(text);
  });

  it('accounts for url encoding cost when truncating', () => {
    // Newlines encode to three characters each, so a fixed character cut would overshoot the limit.
    const url = buildCursorPromptDeeplink('\n'.repeat(20000));

    expect(url.length).toBeLessThanOrEqual(8000);
  });
});

describe('openCursorPromptDeeplink', () => {
  it('navigates the given window to the deep link', () => {
    const win = { location: { href: '' } };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only location.href is read
    openCursorPromptDeeplink('# Notebook', win as unknown as Window);

    expect(win.location.href.startsWith('cursor://')).toBe(true);
  });
});
