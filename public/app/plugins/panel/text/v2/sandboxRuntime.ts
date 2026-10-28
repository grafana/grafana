import type { RenderDiagrams } from './sandboxMermaid';
import {
  MAX_BLOCKED_URL_CHARS,
  RESOURCE_DIRECTIVES,
  resourceOrigin,
  type BlockedResource,
  type BlockedUrl,
} from './sandboxPolicy';
import {
  CSP_CHECK_URL,
  randomId,
  TEXT_FRAME_PROTOCOL,
  type FrameNotification,
  type RenderCommand,
  type MermaidCommand,
} from './sandboxProtocol';

const bootstrap = document.currentScript;
if (!(bootstrap instanceof HTMLScriptElement)) {
  throw new Error('Text runtime must be initialized by its bootstrap script');
}
const channel = bootstrap.dataset.channel!;
const parentOrigin = bootstrap.dataset.parentOrigin!;
const policy = bootstrap.dataset.policy;
const nonce = bootstrap.nonce;
const documentId = randomId();
bootstrap.remove();

// srcdoc inherits Trusted Types enforcement, but not the parent's policies. Match Grafana's
// default HTML policy for library DOM writes; protected panel HTML is sanitized by the parent.
window.trustedTypes?.createPolicy('default', {
  createHTML: (html) => html.replace(/<script/gi, '&lt;script'),
});
// Only the fixed Mermaid bundle received through the authenticated parent channel uses this policy.
const scriptPolicy = window.trustedTypes?.createPolicy('grafana-text-panel-runtime', {
  createScript: (source) => source,
});

let disposed = false;
let verified = policy === undefined;
let started = false;
let violationTimer = 0;
let verificationTimer = 0;
let readyTimer = 0;
let observer: ResizeObserver | undefined;
let content: HTMLDivElement | undefined;
let receiveMermaid: ((source: string) => void) | undefined;
const resources: Array<{
  directive: string;
  origin?: string;
  violations?: Map<string, BlockedUrl>;
  chars: number;
  truncated?: boolean;
}> = [];
const check = document.createElement('img');

function send(message: FrameNotification) {
  if (!disposed) {
    window.parent.postMessage({ ...message, protocol: TEXT_FRAME_PROTOCOL, channel }, parentOrigin);
  }
}

function onViolation(event: SecurityPolicyViolationEvent) {
  if (policy === undefined || event.disposition !== 'enforce') {
    return;
  }
  if (!verified) {
    if (event.blockedURI === CSP_CHECK_URL || event.blockedURI === new URL(CSP_CHECK_URL).origin) {
      // An inherited deployment policy may report the same probe too. Drain both before accepting content.
      clearTimeout(verificationTimer);
      verificationTimer = window.setTimeout(() => {
        verified = true;
        check.remove();
        send({ type: 'ready', document: documentId });
      }, 0);
    }
    return;
  }
  const origin =
    event.originalPolicy === policy && RESOURCE_DIRECTIVES.has(event.effectiveDirective)
      ? resourceOrigin(event.blockedURI)
      : undefined;
  let resource = resources.find((entry) => entry.directive === event.effectiveDirective && entry.origin === origin);
  if (resource && origin === undefined) {
    return;
  }
  if (!resource) {
    resource = { directive: event.effectiveDirective, origin, chars: 0 };
    resources.push(resource);
  }
  if (origin !== undefined) {
    record(resource, event.blockedURI);
  }
  // Batch queued violations without interrupting permitted content or later reports.
  clearTimeout(violationTimer);
  violationTimer = window.setTimeout(() => {
    const references = countReferences();
    send({ type: 'blocked', resources: resources.map((resource) => report(resource, references)) });
  }, 0);
}

function record(resource: (typeof resources)[number], url: string) {
  const violations = (resource.violations ??= new Map());
  const entry = violations.get(url);
  if (entry) {
    entry.count++;
  } else if (resource.chars + url.length <= MAX_BLOCKED_URL_CHARS) {
    violations.set(url, { url, count: 1 });
    resource.chars += url.length;
  } else {
    resource.truncated = true;
  }
}

// Browsers may load a repeated URL once, so a single violation can stand for many elements.
function countReferences() {
  const counts = new Map<string, number>();
  for (const element of content?.querySelectorAll('img, source, video, audio, iframe, embed') ?? []) {
    const urls = new Set<string>();
    for (const url of [Reflect.get(element, 'src'), Reflect.get(element, 'poster')]) {
      if (typeof url === 'string' && url) {
        urls.add(withoutFragment(url));
      }
    }
    for (const url of urls) {
      counts.set(url, (counts.get(url) ?? 0) + 1);
    }
  }
  return counts;
}

// CSP reports leave out the fragment, so references must too to match them.
function withoutFragment(url: string) {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}

function report(
  { directive, origin, violations, truncated }: (typeof resources)[number],
  references: Map<string, number>
): BlockedResource {
  if (!violations) {
    return { directive, origin };
  }
  return {
    directive,
    origin,
    urls: Array.from(violations.values(), (entry) => ({
      ...entry,
      count: Math.max(entry.count, references.get(entry.url) ?? 0),
    })),
    ...(truncated && { truncated }),
  };
}

function measure() {
  if (!content || disposed) {
    return;
  }
  const first = content.firstElementChild;
  const last = content.lastElementChild;
  const contentHeight =
    first instanceof HTMLElement && last instanceof HTMLElement
      ? last.offsetTop + last.offsetHeight - first.offsetTop
      : 0;
  send({ type: 'resize', height: Math.max(1, Math.ceil(content.getBoundingClientRect().height)), contentHeight });
}

async function renderDiagrams(command: RenderCommand, container: HTMLElement) {
  if (!command.mermaid || !container.querySelector('code.language-mermaid, pre.mermaid') || disposed) {
    return;
  }
  const source = await new Promise<string>((resolve) => {
    receiveMermaid = resolve;
    send({ type: 'mermaid-needed' });
  });
  if (disposed) {
    return;
  }
  let render: RenderDiagrams | undefined;
  const script = Object.assign(document.createElement('script'), {
    nonce,
    textContent: scriptPolicy?.createScript(source) ?? source,
    registerMermaid: (renderer: RenderDiagrams) => {
      render = renderer;
    },
  });
  document.head.append(script);
  script.remove();
  if (!render) {
    throw new Error('Text diagram runtime did not initialize');
  }
  await render(command, container, () => disposed);
}

async function render(command: RenderCommand) {
  const style = document.createElement('style');
  style.textContent = `${command.globalCss}\nhtml,body{height:auto!important;min-height:0!important;background:transparent!important}body{margin:0;overflow:hidden!important}.markdown-html{display:flow-root}.mermaid-diagram{margin:16px 0}.mermaid-diagram svg{max-width:100%;height:auto}.mermaid-diagram-error{color:var(--text-error,#f2495c);margin-bottom:4px}`;
  document.head.append(style);
  content = document.createElement('div');
  content.className = 'markdown-html';
  content.setAttribute('data-text-blocks', '');
  document.body.append(content);
  if (policy === undefined) {
    // Legacy unsanitized HTML historically executes scripts. Use this document's range, not the parent's.
    const range = document.createRange();
    range.selectNodeContents(content);
    content.append(range.createContextualFragment(command.html));
  } else {
    content.innerHTML = command.html;
  }
  observer = new ResizeObserver(measure);
  observer.observe(content);
  await document.fonts.ready;
  await renderDiagrams(command, content);
  if (disposed) {
    return;
  }
  measure();
  // Hidden/offscreen cross-origin frames can suspend animation frames. Yield a task for queued CSP reports instead.
  readyTimer = window.setTimeout(() => {
    if (!disposed) {
      send({ type: 'rendered' });
    }
  }, 0);
}

function onMessage(event: MessageEvent<RenderCommand | MermaidCommand>) {
  const command = event.data;
  if (
    event.source !== window.parent ||
    event.origin !== parentOrigin ||
    !command ||
    command.protocol !== TEXT_FRAME_PROTOCOL ||
    command.channel !== channel ||
    !verified ||
    disposed
  ) {
    return;
  }
  if (command.type === 'mermaid-source' && typeof command.source === 'string') {
    receiveMermaid?.(command.source);
    receiveMermaid = undefined;
    return;
  }
  if (
    command.type !== 'render' ||
    started ||
    typeof command.html !== 'string' ||
    typeof command.globalCss !== 'string'
  ) {
    return;
  }
  started = true;
  void render(command).catch(() => send({ type: 'error' }));
}

function dispose() {
  disposed = true;
  receiveMermaid?.('');
  receiveMermaid = undefined;
  observer?.disconnect();
  clearTimeout(violationTimer);
  clearTimeout(readyTimer);
  clearTimeout(verificationTimer);
  document.removeEventListener('securitypolicyviolation', onViolation);
  window.removeEventListener('message', onMessage);
}

document.addEventListener('securitypolicyviolation', onViolation);
window.addEventListener('message', onMessage);
window.addEventListener('pagehide', dispose, { once: true });
if (verified) {
  send({ type: 'ready', document: documentId });
} else {
  check.src = CSP_CHECK_URL;
  document.body.append(check);
}
