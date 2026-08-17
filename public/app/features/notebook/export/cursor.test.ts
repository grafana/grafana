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

// `slice` counts UTF-16 code units, so a cut can land inside a surrogate pair and orphan half of
// it; url encoding then replaces the orphan with U+FFFD rather than throwing, so the symptom is one
// mangled character rather than a failure.
//
// The exact input matters. A lone surrogate encodes to 9 url characters against 12 for the whole
// pair, so the search usually settles back onto a pair boundary on its own — it only orphans when
// the limit falls in that 3-character window. The six-character prefix is what puts it there; with
// no prefix this passes either way and proves nothing.
it('does not cut an emoji in half when truncating', () => {
  const url = buildCursorPromptDeeplink('latenc' + '😀'.repeat(3000));

  const text = new URL(url).searchParams.get('text') ?? '';
  expect(text).not.toContain('\uFFFD');
});

describe('openCursorPromptDeeplink', () => {
  it('navigates the given window to the deep link', () => {
    const win = { location: { href: '' } };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only location.href is read
    openCursorPromptDeeplink('# Notebook', win as unknown as Window);

    expect(win.location.href.startsWith('cursor://')).toBe(true);
  });
});
