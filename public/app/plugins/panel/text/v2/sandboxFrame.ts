import { textUtil } from '@grafana/data';

export interface BlockedResource {
  directive: string;
  origin?: string;
}

export type TextSandboxState =
  | { status: 'loading' | 'ready' }
  | { status: 'blocked'; resources: BlockedResource[] }
  | { status: 'error' };

const RESOURCE_DIRECTIVES = new Set(['img-src', 'media-src', 'font-src', 'style-src', 'style-src-elem', 'frame-src']);
const CHECK_URL = 'https://grafana-csp-check.invalid/';

export function resourceOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function textSandboxPolicy(origins: string[], fontRoot: string): string {
  const sources = [...new Set(origins.map(resourceOrigin).filter((origin) => origin !== undefined))].join(' ');
  const fonts = new URL(fontRoot, document.baseURI);
  // Only trusted Grafana font assets get an exception, not all same-origin resources.
  const fontSource = /^https?:$/.test(fonts.protocol) ? `${fonts.origin}${fonts.pathname}` : '';
  return [
    "default-src 'none'",
    "script-src 'none'",
    `style-src 'unsafe-inline' ${sources}`,
    `img-src data: ${sources}`,
    `font-src ${fontSource} ${sources}`,
    `media-src ${sources || "'none'"}`,
    `frame-src ${sources || "'none'"}`,
    "object-src 'none'",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ]
    .map((directive) => directive.trim())
    .join('; ');
}

export function getGlobalCss(): string {
  return Array.from(document.styleSheets)
    .filter((sheet) => sheet.ownerNode instanceof HTMLElement && sheet.ownerNode.dataset.emotion?.includes('global'))
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules, (rule) => rule.cssText);
      } catch {
        // A stylesheet may be inaccessible while being replaced or supplied cross-origin.
        return [];
      }
    })
    .join('\n');
}

interface MountOptions {
  /** Already sanitized by the Text panel. CSP is an additional network boundary. */
  html: string;
  css: string;
  policy: string;
  title: string;
  onState: (state: TextSandboxState) => void;
  onHeight: (height: number) => void;
}

/** Owns one document generation. A policy change requires a new mount. */
export function mountTextSandbox(host: HTMLElement, options: MountOptions): () => void {
  const frame = document.createElement('iframe');
  frame.title = options.title;
  frame.sandbox.value =
    'allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation';
  frame.referrerPolicy = 'no-referrer';
  frame.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:100%;height:1px;border:0;';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  const escapedPolicy = textUtil.escapeHtml(options.policy);
  // Never put user HTML in srcdoc: the listener must exist before the first resource load.
  frame.srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${escapedPolicy}"><base target="_blank"></head><body></body></html>`;

  let disposed = false;
  let blocked = false;
  let loaded = false;
  let verified = false;
  let observer: ResizeObserver | undefined;
  let doc: Document | null = null;
  let firstPaint = 0;
  let secondPaint = 0;
  let removalTimer = 0;
  const resources: BlockedResource[] = [];

  const fail = () => {
    if (!disposed) {
      blocked = true;
      frame.remove();
      options.onState({ status: 'error' });
    }
  };
  // Sandboxed event listeners are unavailable in some engines. Never inject data until verified.
  const watchdog = window.setTimeout(fail, 3000);

  const populate = () => {
    if (disposed || blocked || !doc) {
      return;
    }
    const style = doc.createElement('style');
    style.textContent = `${options.css}\nhtml,body{height:auto!important;min-height:0!important;background:transparent!important}body{overflow:hidden!important} .markdown-html{display:flow-root}`;
    doc.head.append(style);
    doc.body.innerHTML = '<div class="markdown-html" data-text-blocks></div>';
    const content = doc.body.firstElementChild!;
    content.innerHTML = options.html;
    const measure = () => {
      if (disposed || blocked || !doc) {
        return;
      }
      const height = Math.max(1, Math.ceil(doc.body.getBoundingClientRect().height));
      frame.style.height = `${height}px`;
      options.onHeight(height);
    };
    observer = new ResizeObserver(measure);
    observer.observe(doc.body);
    measure();
    // This only avoids initial broken-content flashes. CSP remains enforced after reveal.
    firstPaint = requestAnimationFrame(() => {
      secondPaint = requestAnimationFrame(() => {
        if (!disposed && !blocked) {
          frame.style.position = 'static';
          frame.style.visibility = 'visible';
          frame.style.pointerEvents = 'auto';
          frame.removeAttribute('aria-hidden');
          frame.removeAttribute('tabindex');
          options.onState({ status: 'ready' });
        }
      });
    });
  };

  const onViolation = (event: SecurityPolicyViolationEvent) => {
    if (disposed || event.disposition !== 'enforce') {
      return;
    }
    if (!verified) {
      if (event.blockedURI === CHECK_URL || event.blockedURI === new URL(CHECK_URL).origin) {
        verified = true;
        clearTimeout(watchdog);
        doc?.body.replaceChildren();
        populate();
      }
      return;
    }
    blocked = true;
    frame.style.visibility = 'hidden';
    frame.style.pointerEvents = 'none';
    observer?.disconnect();
    const origin = resourceOrigin(event.blockedURI);
    const resource: BlockedResource = {
      directive: event.effectiveDirective,
      origin:
        event.originalPolicy === options.policy && RESOURCE_DIRECTIVES.has(event.effectiveDirective)
          ? origin
          : undefined,
    };
    if (!resources.some((entry) => entry.origin === resource.origin && entry.directive === resource.directive)) {
      resources.push(resource);
    }
    // Allow already queued violations to join the same consent request before destroying the document.
    clearTimeout(removalTimer);
    removalTimer = window.setTimeout(() => {
      if (!disposed) {
        frame.remove();
        options.onState({ status: 'blocked', resources: [...resources] });
      }
    }, 0);
  };

  frame.onload = () => {
    if (disposed || loaded) {
      return;
    }
    loaded = true;
    doc = frame.contentDocument;
    if (!doc?.body) {
      fail();
      return;
    }
    doc.addEventListener('securitypolicyviolation', onViolation);
    const check = doc.createElement('img');
    check.src = CHECK_URL;
    doc.body.append(check);
  };
  options.onState({ status: 'loading' });
  host.append(frame);

  return () => {
    disposed = true;
    clearTimeout(watchdog);
    clearTimeout(removalTimer);
    cancelAnimationFrame(firstPaint);
    cancelAnimationFrame(secondPaint);
    observer?.disconnect();
    doc?.removeEventListener('securitypolicyviolation', onViolation);
    frame.onload = null;
    frame.remove();
  };
}
