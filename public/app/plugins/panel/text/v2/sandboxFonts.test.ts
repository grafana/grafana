import { inlineSandboxFonts } from './sandboxFonts';

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
