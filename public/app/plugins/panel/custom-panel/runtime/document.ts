import { DRAWING_API_VERSION, MAX_CODE_BYTES, RENDER_TARGET_CLASS } from './constants';
import {
  BOOTSTRAP_API_VERSION_PLACEHOLDER,
  BOOTSTRAP_CODE_PLACEHOLDER,
  BOOTSTRAP_CONTENT_PLACEHOLDER,
  BOOTSTRAP_NONCE_PLACEHOLDER,
  CONTENT_BOOTSTRAP_SOURCE,
  WRAPPER_BOOTSTRAP_SOURCE,
} from './frameBootstrap';

export type BuildDocumentResult =
  | { ok: true; srcdoc: string; documentKey: string }
  | { ok: false; reason: 'code-too-large'; bytes: number };

const NONCE_PATTERN = /^[a-zA-Z0-9+/_=-]+$/;

/** The content frame runs the user code. It has no network, no frames, no workers and no eval. */
export function contentDocumentCsp(nonce: string): string {
  return (
    `default-src 'none'; script-src 'nonce-${nonce}'; script-src-attr 'none'; style-src 'unsafe-inline'; ` +
    `img-src data: blob:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; child-src 'none'; ` +
    `worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; manifest-src 'none'`
  );
}

/**
 * The wrapper's frame-src 'none' is what stops the content frame from navigating itself to a
 * network URL. The content document inherits this policy (srcdoc inherits its parent's policy
 * container), so img-src and font-src must allow what the content policy allows, or data: images
 * and fonts in the drawing would be blocked by the wrapper's default-src.
 */
export function wrapperDocumentCsp(nonce: string): string {
  return (
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; ` +
    `frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`
  );
}

export const CONTENT_BASE_STYLE =
  ':root{color-scheme:light dark;overscroll-behavior:none} ' +
  'html,body{margin:0;height:100%;background:transparent;font-family:var(--gf-font-family);color:var(--gf-color-text-primary)} ' +
  '#root{min-height:100%}';

export const RENDER_TARGET_STYLE = '*{animation:none!important;transition:none!important}';

const WRAPPER_STYLE =
  ':root{color-scheme:light dark} html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}';

/**
 * Builds the wrapper srcdoc for the host iframe. The user code is never spliced into markup: it
 * travels as an escaped JSON string and the bootstrap inserts it as a nonce'd script element.
 */
export function buildRenderDocument(params: {
  code: string;
  /** Exposed to the code as panel.apiVersion; the host only builds documents for supported versions. */
  apiVersion?: number;
  isRenderTarget: boolean;
  nonce?: string;
}): BuildDocumentResult {
  const bytes = utf8ByteLength(params.code);
  if (bytes > MAX_CODE_BYTES) {
    return { ok: false, reason: 'code-too-large', bytes };
  }
  const nonce = params.nonce !== undefined && NONCE_PATTERN.test(params.nonce) ? params.nonce : randomNonce();
  const apiVersion =
    Number.isSafeInteger(params.apiVersion) && params.apiVersion! > 0 ? params.apiVersion! : DRAWING_API_VERSION;
  const content = contentDocument(params.code, nonce, params.isRenderTarget, apiVersion);
  const wrapperScript = WRAPPER_BOOTSTRAP_SOURCE.replace(BOOTSTRAP_CONTENT_PLACEHOLDER, () => scriptLiteral(content));
  const srcdoc =
    `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${wrapperDocumentCsp(nonce)}">` +
    `<meta charset="utf-8"><style>${WRAPPER_STYLE}</style></head><body>` +
    `<script nonce="${nonce}">${wrapperScript}</script></body></html>`;
  return { ok: true, srcdoc, documentKey: fnv1aHex(`${apiVersion}:${params.code}${nonce}`) };
}

/** The content document alone, which the wrapper loads as its child's srcdoc. */
export function contentDocument(
  code: string,
  nonce: string,
  isRenderTarget: boolean,
  apiVersion: number = DRAWING_API_VERSION
): string {
  const script = CONTENT_BOOTSTRAP_SOURCE.replace(BOOTSTRAP_NONCE_PLACEHOLDER, () => scriptLiteral(nonce))
    .replace(BOOTSTRAP_API_VERSION_PLACEHOLDER, () => String(Math.trunc(apiVersion)))
    .replace(BOOTSTRAP_CODE_PLACEHOLDER, () => scriptLiteral(code));
  const style = isRenderTarget ? `${CONTENT_BASE_STYLE} ${RENDER_TARGET_STYLE}` : CONTENT_BASE_STYLE;
  const htmlAttributes = isRenderTarget ? ` class="${RENDER_TARGET_CLASS}"` : '';
  return (
    `<!doctype html><html${htmlAttributes}><head><meta http-equiv="Content-Security-Policy" content="${contentDocumentCsp(nonce)}">` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${style}</style></head><body><div id="root"></div>` +
    `<script nonce="${nonce}">${script}</script></body></html>`
  );
}

/**
 * srcdoc inherits Grafana's CSP, so the frame scripts must carry the host nonce when there is one.
 * Read the DOM property: browsers hide the attribute value from getAttribute().
 */
export function readHostNonce(doc: Document = document): string | undefined {
  const nonce = doc.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
  return nonce && NONCE_PATTERN.test(nonce) ? nonce : undefined;
}

/** A JSON string literal that is safe inside a script element and inside srcdoc markup. */
function scriptLiteral(value: string): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function fnv1aHex(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
