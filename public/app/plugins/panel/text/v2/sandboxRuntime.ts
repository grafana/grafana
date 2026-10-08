import type { RenderDiagrams } from './sandboxMermaid';
import { RESOURCE_DIRECTIVES, resourceOrigin, type BlockedResource } from './sandboxPolicy';
import {
  CSP_CHECK_URL,
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
bootstrap.remove();

let disposed = false;
let verified = policy === undefined;
let started = false;
let violationTimer = 0;
let verificationTimer = 0;
let readyTimer = 0;
let observer: ResizeObserver | undefined;
let content: HTMLDivElement | undefined;
let receiveMermaid: ((source: string) => void) | undefined;
const resources: BlockedResource[] = [];
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
        send({ type: 'ready' });
      }, 0);
    }
    return;
  }
  const resource: BlockedResource = {
    directive: event.effectiveDirective,
    origin:
      event.originalPolicy === policy && RESOURCE_DIRECTIVES.has(event.effectiveDirective)
        ? resourceOrigin(event.blockedURI)
        : undefined,
  };
  if (!resources.some((entry) => entry.directive === resource.directive && entry.origin === resource.origin)) {
    resources.push(resource);
    // Batch queued violations without interrupting permitted content or later reports.
    clearTimeout(violationTimer);
    violationTimer = window.setTimeout(() => send({ type: 'blocked', resources }), 0);
  }
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
    textContent: source,
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
  send({ type: 'ready' });
} else {
  check.src = CSP_CHECK_URL;
  document.body.append(check);
}
