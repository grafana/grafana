import { MAX_CODE_BYTES } from './constants';
import {
  buildRenderDocument,
  contentDocument,
  contentDocumentCsp,
  readHostNonce,
  wrapperDocumentCsp,
} from './document';

const NONCE = 'abc123+/=';

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('buildRenderDocument', () => {
  it('uses the exact content policy, which has no network and no eval', () => {
    const csp = contentDocumentCsp(NONCE);
    expect(csp).toBe(
      "default-src 'none'; script-src 'nonce-abc123+/='; script-src-attr 'none'; style-src 'unsafe-inline'; " +
        "img-src data: blob:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; child-src 'none'; " +
        "worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; manifest-src 'none'"
    );
    expect(csp).not.toContain('unsafe-eval');
  });

  it('puts the wrapper policy, with frame-src none, first in the wrapper head', () => {
    const result = buildRenderDocument({ code: '', isRenderTarget: false, nonce: NONCE });
    if (!result.ok) {
      throw new Error('expected a document');
    }
    expect(wrapperDocumentCsp(NONCE)).toContain("frame-src 'none'");
    expect(wrapperDocumentCsp(NONCE)).not.toContain('unsafe-eval');
    expect(
      result.srcdoc.startsWith(
        `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${wrapperDocumentCsp(NONCE)}">`
      )
    ).toBe(true);
  });

  it('embeds hostile code only as an escaped string', () => {
    const code = "panel.onRender(() => {}); '</script><img src=x onerror=alert(1)>' + '<!--'";
    const result = buildRenderDocument({ code, isRenderTarget: false, nonce: NONCE });
    if (!result.ok) {
      throw new Error('expected a document');
    }
    // The wrapper template has exactly one script element; the content document is escaped inside it.
    expect(countOccurrences(result.srcdoc, '</script')).toBe(1);
    expect(result.srcdoc).not.toContain('<img');
    expect(result.srcdoc).not.toContain('<!--');
    expect(result.srcdoc).toContain('u003c/script>');
    expect(result.srcdoc).toContain('u003cimg src=x onerror=alert(1)>');

    const content = contentDocument(code, NONCE, false);
    expect(countOccurrences(content, '</script')).toBe(1);
    expect(content).not.toContain('<img');
    expect(content).not.toContain('<!--');
  });

  it('adds the no-animation style and the render target class only on render targets', () => {
    expect(contentDocument('', NONCE, true)).toContain('*{animation:none!important;transition:none!important}');
    expect(contentDocument('', NONCE, true)).toContain('<html class="gf-render-target">');
    expect(contentDocument('', NONCE, false)).not.toContain('animation:none');
    expect(contentDocument('', NONCE, false)).toContain('<!doctype html><html><head>');
  });

  it('embeds the panel apiVersion as a number, defaulting to the latest', () => {
    expect(contentDocument('', NONCE, false, 3)).toContain('var API_VERSION = 3;');
    expect(contentDocument('', NONCE, false)).toContain('var API_VERSION = 1;');
    // User code that contains the placeholder is left alone.
    expect(contentDocument('__RENDER_API_VERSION__', NONCE, false, 3)).toContain('"__RENDER_API_VERSION__"');
  });

  it('refuses code over the byte limit, counting UTF-8 bytes', () => {
    // 'é' is two bytes in UTF-8, so half the limit in characters is already at the limit.
    const atLimit = 'é'.repeat(MAX_CODE_BYTES / 2);
    expect(buildRenderDocument({ code: atLimit, isRenderTarget: false, nonce: NONCE }).ok).toBe(true);
    expect(buildRenderDocument({ code: `${atLimit}x`, isRenderTarget: false, nonce: NONCE })).toEqual({
      ok: false,
      reason: 'code-too-large',
      bytes: MAX_CODE_BYTES + 1,
    });
  });

  it('keys the document on code, nonce and apiVersion', () => {
    const first = buildRenderDocument({ code: 'a', isRenderTarget: false, nonce: NONCE });
    const same = buildRenderDocument({ code: 'a', isRenderTarget: true, nonce: NONCE });
    const otherCode = buildRenderDocument({ code: 'b', isRenderTarget: false, nonce: NONCE });
    if (!first.ok || !same.ok || !otherCode.ok) {
      throw new Error('expected documents');
    }
    expect(first.documentKey).toMatch(/^[0-9a-f]{8}$/);
    expect(same.documentKey).toBe(first.documentKey);
    expect(otherCode.documentKey).not.toBe(first.documentKey);
    const otherVersion = buildRenderDocument({ code: 'a', apiVersion: 2, isRenderTarget: false, nonce: NONCE });
    expect(otherVersion.ok && otherVersion.documentKey).not.toBe(first.documentKey);
  });

  it('replaces an invalid nonce with a random base64 one', () => {
    const result = buildRenderDocument({ code: '', isRenderTarget: false, nonce: 'bad"nonce' });
    if (!result.ok) {
      throw new Error('expected a document');
    }
    expect(result.srcdoc).not.toContain('bad"nonce');
    expect(result.srcdoc).toMatch(/<script nonce="[A-Za-z0-9+/]{22}==">/);
  });
});

describe('readHostNonce', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('reads the nonce property, not the attribute', () => {
    const script = document.createElement('script');
    // Browsers hide the attribute value and keep the nonce only in the property; mimic that.
    script.setAttribute('nonce', '');
    Object.defineProperty(script, 'nonce', { value: 'hostNonce123' });
    document.head.append(script);
    expect(readHostNonce(document)).toBe('hostNonce123');
  });

  it('rejects a nonce with characters outside base64', () => {
    const script = document.createElement('script');
    script.setAttribute('nonce', '');
    Object.defineProperty(script, 'nonce', { value: "x' 'unsafe-inline" });
    document.head.append(script);
    expect(readHostNonce(document)).toBeUndefined();
  });

  it('returns undefined without a nonce script', () => {
    expect(readHostNonce(document)).toBeUndefined();
  });
});
