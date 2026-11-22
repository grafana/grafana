import { getPreparedSandboxFonts, inlineSandboxFonts } from './sandboxFonts';

describe('inlineSandboxFonts', () => {
  const originalFetch = global.fetch;
  const originalTimeout = AbortSignal.timeout;
  const fetchFont = jest.fn();

  beforeEach(() => {
    global.fetch = fetchFont;
    // JSDOM does not implement this browser API.
    AbortSignal.timeout = () => new AbortController().signal;
    fetchFont.mockReset();
    fetchFont.mockResolvedValue({ ok: true, blob: async () => new Blob(['font'], { type: 'font/woff2' }) });
  });

  afterAll(() => {
    global.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  });

  it('embeds trusted fonts and caches their bytes across panels', async () => {
    const css = '@font-face { src: url("/public/fonts/test.woff2"); }';
    const embedded = await inlineSandboxFonts(css, '/public/fonts/');
    expect(embedded).toBe('@font-face { src: url("data:font/woff2;base64,Zm9udA=="); }');
    expect(await inlineSandboxFonts(css, '/public/fonts/')).toBe(embedded);
    expect(fetchFont).toHaveBeenCalledTimes(1);
    expect(fetchFont).toHaveBeenCalledWith(`${window.location.origin}/public/fonts/test.woff2`, expect.any(Object));
  });

  it('shares stylesheet preparation and refreshes it when CSS or the font root changes', async () => {
    const css = '@font-face { src: url("/public/fonts/shared.woff2"); }';
    const first = inlineSandboxFonts(css, '/public/fonts/');
    expect(getPreparedSandboxFonts(css, '/public/fonts/')).toBeUndefined();
    expect(inlineSandboxFonts(css, '/public/fonts/')).toBe(first);
    expect(await first).toBe('@font-face { src: url("data:font/woff2;base64,Zm9udA=="); }');
    expect(getPreparedSandboxFonts(css, '/public/fonts/')).toBe(
      '@font-face { src: url("data:font/woff2;base64,Zm9udA=="); }'
    );
    expect(getPreparedSandboxFonts(css, '/different/fonts/')).toBeUndefined();
    expect(getPreparedSandboxFonts(`${css} p{color:red}`, '/public/fonts/')).toBeUndefined();
    expect(inlineSandboxFonts(css, '/public/fonts/')).toBe(first);

    expect(await inlineSandboxFonts(`${css} body { color: red; }`, '/public/fonts/')).toBe(
      '@font-face { src: url("data:font/woff2;base64,Zm9udA=="); } body { color: red; }'
    );
    expect(await inlineSandboxFonts(css, '/other/fonts/')).toBe(css);
    expect(fetchFont).toHaveBeenCalledTimes(1);
  });

  it('does not replace a newer prepared entry when an older font finishes later', async () => {
    let finish!: (response: { ok: boolean; blob: () => Promise<Blob> }) => void;
    fetchFont.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const oldCss = '@font-face { src: url("/public/fonts/slow.woff2"); }';
    const old = inlineSandboxFonts(oldCss, '/public/fonts/');
    const newCss = 'p{color:blue}';
    await inlineSandboxFonts(newCss, '/public/fonts/');
    finish({ ok: true, blob: async () => new Blob(['font']) });
    await old;
    expect(getPreparedSandboxFonts(newCss, '/public/fonts/')).toBe(newCss);
    expect(getPreparedSandboxFonts(oldCss, '/public/fonts/')).toBeUndefined();
    const base = document.createElement('base');
    base.href = 'https://different.test/';
    document.head.append(base);
    try {
      expect(getPreparedSandboxFonts(newCss, '/public/fonts/')).toBeUndefined();
    } finally {
      base.remove();
    }
  });

  it.each([
    'https://external.test/public/fonts/test.woff2',
    '/public/fonts/../private.woff2',
    '/public/fonts-other/test.woff2',
    '/public/fonts/test.woff2?secret=123',
    '/public/fonts/test.woff2#fragment',
    '/public/fonts/not-a-font.txt',
    'data:font/woff2;base64,Zm9udA==',
    'http://[invalid',
  ])('never fetches an untrusted or malformed URL: %s', async (url) => {
    const css = `@font-face { src: url("${url}"); }`;
    expect(await inlineSandboxFonts(css, '/public/fonts')).toBe(css);
    expect(fetchFont).not.toHaveBeenCalled();
  });

  it('uses a local fallback when a trusted asset cannot be loaded', async () => {
    fetchFont.mockRejectedValue(new Error('offline'));
    expect(await inlineSandboxFonts('src: url(/public/fonts/missing.woff2)', '/public/fonts/')).toBe(
      'src: local("Arial")'
    );
  });
});
