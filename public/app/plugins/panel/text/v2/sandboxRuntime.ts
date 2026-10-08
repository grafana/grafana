import DOMPurify from 'dompurify';
import mermaid from 'mermaid';

import { RESOURCE_DIRECTIVES, resourceOrigin, type BlockedResource } from './sandboxPolicy';
import { CSP_CHECK_URL, TEXT_FRAME_PROTOCOL, type FrameNotification, type RenderCommand } from './sandboxProtocol';

const bootstrap = document.currentScript;
if (!(bootstrap instanceof HTMLScriptElement)) {
  throw new Error('Text runtime must be initialized by its bootstrap script');
}
const channel = bootstrap.dataset.channel!;
const parentOrigin = bootstrap.dataset.parentOrigin!;
const policy = bootstrap.dataset.policy;
bootstrap.remove();

let disposed = false;
let blocked = false;
let verified = policy === undefined;
let started = false;
let removalTimer = 0;
let verificationTimer = 0;
let readyTimer = 0;
let observer: ResizeObserver | undefined;
let content: HTMLDivElement | undefined;
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
  blocked = true;
  // Hide in the same task as the violation; parent React receives the message asynchronously.
  document.documentElement.style.setProperty('display', 'none', 'important');
  observer?.disconnect();
  send({ type: 'hide' });
  const resource: BlockedResource = {
    directive: event.effectiveDirective,
    origin:
      event.originalPolicy === policy && RESOURCE_DIRECTIVES.has(event.effectiveDirective)
        ? resourceOrigin(event.blockedURI)
        : undefined,
  };
  if (!resources.some((entry) => entry.directive === resource.directive && entry.origin === resource.origin)) {
    resources.push(resource);
  }
  // Preserve already queued violations in a single consent request.
  clearTimeout(removalTimer);
  removalTimer = window.setTimeout(() => send({ type: 'blocked', resources }), 0);
}

function measure() {
  if (!content || blocked || disposed) {
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
  if (!command.mermaid) {
    return;
  }
  mermaid.initialize({
    ...command.mermaid,
    securityLevel: 'strict',
    startOnLoad: false,
    htmlLabels: false,
    flowchart: { ...command.mermaid.flowchart, htmlLabels: false },
    secure: [
      'secure',
      'securityLevel',
      'startOnLoad',
      'maxTextSize',
      'maxEdges',
      'suppressErrorRendering',
      'htmlLabels',
      'flowchart',
    ],
    suppressErrorRendering: true,
  });
  let id = 0;
  for (const block of container.querySelectorAll('code.language-mermaid, pre.mermaid')) {
    if (blocked || disposed) {
      return;
    }
    const target = block.tagName === 'CODE' ? block.parentElement! : block;
    try {
      const result = await mermaid.render(`text-mermaid-${++id}`, target.textContent ?? '');
      if (blocked || disposed) {
        return;
      }
      const diagram = document.createElement('div');
      diagram.className = 'mermaid-diagram';
      diagram.innerHTML = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      target.replaceWith(diagram);
    } catch {
      // CSP failures can reject Mermaid's image decoding too. The violation handler owns consent.
      if (!blocked && !disposed) {
        const error = document.createElement('div');
        error.className = 'mermaid-diagram-error';
        error.setAttribute('role', 'status');
        error.textContent = command.diagramError;
        target.before(error);
      }
    }
  }
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
  if (blocked || disposed) {
    return;
  }
  measure();
  // Hidden/offscreen cross-origin frames can suspend animation frames. Yield a task for queued CSP reports instead.
  readyTimer = window.setTimeout(() => {
    if (!blocked && !disposed) {
      send({ type: 'rendered' });
    }
  }, 0);
}

function onMessage(event: MessageEvent<RenderCommand>) {
  const command = event.data;
  if (
    event.source !== window.parent ||
    event.origin !== parentOrigin ||
    !command ||
    command.protocol !== TEXT_FRAME_PROTOCOL ||
    command.channel !== channel ||
    command.type !== 'render' ||
    !verified ||
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
  observer?.disconnect();
  clearTimeout(removalTimer);
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
