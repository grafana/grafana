import type { MermaidConfig } from 'mermaid';
import { useLayoutEffect, useRef, useState } from 'react';

import { textUtil } from '@grafana/data';

import { loadSandboxMermaid, loadSandboxRuntime } from './loadSandboxRuntime';
import {
  MAX_BLOCKED_URL_CHARS,
  resourceOrigin,
  urlChars,
  type BlockedResource,
  type BlockedUrl,
  type TextSandboxState,
} from './sandboxPolicy';
import {
  isFrameNotification,
  randomId,
  TEXT_FRAME_PROTOCOL,
  type RenderCommand,
  type MermaidCommand,
} from './sandboxProtocol';

export const WATCHDOG_TIMEOUT_MS = 15_000;

let shellPolicy: Pick<TrustedTypePolicy, 'createHTML'> | undefined;

export interface SandboxFrameProps {
  /** Sanitized when protected; legacy HTML respects the administrator's sanitizer setting. */
  html: string;
  globalCss: string;
  /** Omitted, not empty, for panels without dataframes. */
  policy?: string;
  mermaid?: MermaidConfig;
  diagramError?: string;
  title: string;
  onState: (state: TextSandboxState | undefined) => void;
  onHeight: (height: number, contentHeight: number) => void;
}

export function SandboxFrame(props: SandboxFrameProps) {
  const { html, globalCss, policy, mermaid, diagramError } = props;
  const [documentVersion, setDocumentVersion] = useState({ html, globalCss, policy, mermaid, diagramError, id: 0 });
  if (
    documentVersion.html !== html ||
    documentVersion.globalCss !== globalCss ||
    documentVersion.policy !== policy ||
    documentVersion.mermaid !== mermaid ||
    documentVersion.diagramError !== diagramError
  ) {
    setDocumentVersion({ html, globalCss, policy, mermaid, diagramError, id: documentVersion.id + 1 });
  }
  // Fresh documents isolate each render's messages and runtime; an applied CSP also cannot be relaxed in place.
  return <FrameDocument key={documentVersion.id} {...props} />;
}

function FrameDocument(props: SandboxFrameProps) {
  const { title, onState, onHeight } = props;
  const { iframeRef, sandboxState, dimensions, protectedFrame } = useFrameRuntime(props);

  // Keep reporting separate from runtime setup: state or consumer changes must not restart the frame's protocol.
  useLayoutEffect(() => {
    onState(sandboxState);
  }, [onState, sandboxState]);
  // Combining this cleanup with reporting would emit undefined before every state update.
  // Only consumer replacement or document unmount should invalidate the previous report.
  useLayoutEffect(() => {
    return () => onState(undefined);
  }, [onState]);
  // Dimensions and sandbox reports change independently; combining them would notify unrelated consumers.
  useLayoutEffect(() => {
    if (dimensions.contentHeight > 0) {
      onHeight(dimensions.height, dimensions.contentHeight);
    }
  }, [onHeight, dimensions]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      sandbox={
        protectedFrame
          ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation'
          : undefined
      }
      referrerPolicy={protectedFrame ? 'no-referrer' : undefined}
      data-text-content-height={dimensions.contentHeight || undefined}
      style={{
        width: '100%',
        height: dimensions.height,
        border: 0,
      }}
    />
  );
}

function useFrameRuntime({
  html,
  globalCss,
  policy,
  mermaid,
  diagramError = 'Diagram could not be rendered',
}: SandboxFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sandboxState, setSandboxState] = useState<TextSandboxState>({ status: 'loading', resources: [] });
  const [dimensions, setDimensions] = useState({ height: 1, contentHeight: 0 });
  const [channel] = useState(randomId);
  // srcdoc inherits deployment CSP, so reuse Grafana's server nonce when one is present.
  const [nonce] = useState(() => document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || randomId());
  const protectedFrame = policy !== undefined;

  useLayoutEffect(() => {
    if (!iframeRef.current) {
      return;
    }
    const controller = createFrameController({
      iframe: iframeRef.current,
      policy,
      nonce,
      protectedFrame,
      renderCommand: {
        protocol: TEXT_FRAME_PROTOCOL,
        channel,
        type: 'render',
        html,
        globalCss,
        mermaid,
        diagramError,
      },
      onStatus: (status) =>
        setSandboxState((current) => (current.status === status ? current : { ...current, status })),
      onResize: setDimensions,
      onBlocked: (incoming) =>
        setSandboxState((current) => {
          const resources = mergeResources(current.resources, incoming);
          return resources === current.resources ? current : { ...current, resources };
        }),
    });
    return controller.dispose;
  }, [channel, diagramError, globalCss, html, mermaid, nonce, policy, protectedFrame]);

  return { iframeRef, sandboxState, dimensions, protectedFrame };
}

interface FrameControllerOptions {
  iframe: HTMLIFrameElement;
  policy?: string;
  nonce: string;
  protectedFrame: boolean;
  renderCommand: RenderCommand;
  onStatus: (status: TextSandboxState['status']) => void;
  onResize: (dimensions: { height: number; contentHeight: number }) => void;
  onBlocked: (resources: BlockedResource[]) => void;
}

function createFrameController({
  iframe,
  policy,
  nonce,
  protectedFrame,
  renderCommand,
  onStatus,
  onResize,
  onBlocked,
}: FrameControllerOptions) {
  // Protocol guards update synchronously, independently of React's reported state.
  let renderedDocument: string | undefined;
  let hasFailed = false;
  let mermaidRequested = false;
  let disposed = false;
  const expectedOrigin = protectedFrame ? 'null' : window.location.origin;
  // Opaque-origin frames require '*'; commands still target only this document's WindowProxy.
  const targetOrigin = protectedFrame ? '*' : window.location.origin;
  let watchdog = window.setTimeout(fail, WATCHDOG_TIMEOUT_MS);
  window.addEventListener('message', onMessage);
  void loadSandboxRuntime()
    .then((runtimeSource) => {
      if (disposed) {
        return;
      }
      const shell = buildFrameShell({
        runtimeSource,
        policy,
        nonce,
        channel: renderCommand.channel,
        parentOrigin: window.location.origin,
      });
      assignFrameShell(iframe, shell);
    })
    .catch(() => {
      if (!disposed) {
        fail();
      }
    });

  function onMessage(event: MessageEvent) {
    const message = event.data;
    if (
      disposed ||
      !iframe.contentWindow ||
      event.source !== iframe.contentWindow ||
      event.origin !== expectedOrigin ||
      !isFrameNotification(message) ||
      message.channel !== renderCommand.channel
    ) {
      return;
    }
    switch (message.type) {
      case 'ready':
        return sendRender(message.document);
      case 'mermaid-needed':
        return loadRequestedMermaid();
      case 'rendered':
        return markRendered();
      case 'resize':
        return updateDimensions(message.height, message.contentHeight);
      case 'blocked':
        return recordBlockedResources(message.resources);
      case 'error':
        return fail();
    }
  }

  function sendRender(documentId: string) {
    // Protected frames verify CSP violation delivery before sending ready and receiving panel data.
    if (renderedDocument === documentId) {
      return;
    }
    // Moving an iframe within the DOM reloads its srcdoc. The new document passed its own CSP check, so it is a
    // fresh attempt even if the previous one failed.
    if (renderedDocument !== undefined) {
      hasFailed = false;
      mermaidRequested = false;
      clearTimeout(watchdog);
      watchdog = window.setTimeout(fail, WATCHDOG_TIMEOUT_MS);
    } else if (hasFailed) {
      return;
    }
    renderedDocument = documentId;
    iframe.contentWindow?.postMessage(renderCommand, targetOrigin);
  }

  function loadRequestedMermaid() {
    if (renderedDocument === undefined || hasFailed || !renderCommand.mermaid || mermaidRequested) {
      return;
    }
    mermaidRequested = true;
    const target = iframe.contentWindow;
    // A reloaded document requests its own copy; a late result for the previous one must not fail it.
    const requestedBy = renderedDocument;
    const isCurrent = () => !disposed && renderedDocument === requestedBy;
    void loadSandboxMermaid()
      .then((source) => {
        if (!isCurrent() || hasFailed || !target || iframe.contentWindow !== target) {
          return;
        }
        const command: MermaidCommand = {
          protocol: TEXT_FRAME_PROTOCOL,
          channel: renderCommand.channel,
          type: 'mermaid-source',
          source,
        };
        target.postMessage(command, targetOrigin);
      })
      .catch(() => {
        if (isCurrent()) {
          fail();
        }
      });
  }

  function markRendered() {
    if (renderedDocument !== undefined && !hasFailed) {
      clearTimeout(watchdog);
      onStatus('ready');
    }
  }

  // Content can still resize or report violations after a rendering failure.
  function updateDimensions(height: number, contentHeight: number) {
    if (renderedDocument !== undefined) {
      onResize({ height, contentHeight });
    }
  }

  function recordBlockedResources(resources: BlockedResource[]) {
    if (renderedDocument !== undefined) {
      onBlocked(resources);
    }
  }

  function fail() {
    hasFailed = true;
    clearTimeout(watchdog);
    onStatus('error');
  }

  function dispose() {
    disposed = true;
    clearTimeout(watchdog);
    window.removeEventListener('message', onMessage);
  }

  return { dispose };
}

function buildFrameShell({
  runtimeSource,
  policy,
  nonce,
  channel,
  parentOrigin,
}: {
  runtimeSource: string;
  policy?: string;
  nonce: string;
  channel: string;
  parentOrigin: string;
}) {
  const escape = textUtil.escapeHtml;
  const appliedPolicy = policy?.replace("script-src 'none'", `script-src 'nonce-${nonce}'`);
  const escapedPolicy = appliedPolicy === undefined ? undefined : escape(appliedPolicy);
  const cspMeta =
    escapedPolicy === undefined ? '' : `<meta http-equiv="Content-Security-Policy" content="${escapedPolicy}">`;
  const policyAttribute = escapedPolicy === undefined ? '' : ` data-policy="${escapedPolicy}"`;
  const scriptSource = runtimeSource.replace(/<\/script/gi, '<\\/script');

  return `<!doctype html><html><head><meta http-equiv="x-dns-prefetch-control" content="off">${cspMeta}<base target="_blank"></head><body><script nonce="${escape(nonce)}" data-channel="${escape(channel)}" data-parent-origin="${escape(parentOrigin)}"${policyAttribute}>${scriptSource}</script></body></html>`;
}

function assignFrameShell(iframe: HTMLIFrameElement, shell: string) {
  // Only the application-built shell reaches this policy; panel HTML arrives later by message.
  shellPolicy ??= window.trustedTypes?.createPolicy('grafana-text-panel-shell', {
    createHTML: (html: string) => html,
  });
  // React stringifies srcDoc, discarding TrustedHTML. Assign it directly without changing the default policy.
  Object.assign(iframe, { srcdoc: shellPolicy?.createHTML(shell) ?? shell });
}

/** Returns `current` when nothing changed, so a repeated report doesn't re-render. */
function mergeResources(current: BlockedResource[], reported: BlockedResource[]): BlockedResource[] {
  let changed = false;
  const resources = [...current];
  for (const resource of reported) {
    const origin = resource.origin ? resourceOrigin(resource.origin) : undefined;
    // The frame is untrusted, so drop URLs that don't match the origin they're reported under.
    const urls = origin ? resource.urls?.filter(({ url }) => resourceOrigin(url) === origin) : undefined;
    let index = resources.findIndex((entry) => entry.directive === resource.directive && entry.origin === origin);
    if (index === -1) {
      index = resources.push({ directive: resource.directive, origin }) - 1;
      changed = true;
    }
    if (!urls) {
      continue;
    }
    const entry = resources[index];
    const merged = mergeUrls(entry.urls ?? [], urls);
    const truncated = Boolean(entry.truncated || resource.truncated || merged.dropped);
    if (merged.urls !== entry.urls || truncated !== Boolean(entry.truncated)) {
      resources[index] = { ...entry, urls: merged.urls, ...(truncated && { truncated }) };
      changed = true;
    }
  }
  return changed ? resources : current;
}

/** `dropped` is true when the budget left out a URL. */
function mergeUrls(current: BlockedUrl[], reported: BlockedUrl[]): { urls: BlockedUrl[]; dropped: boolean } {
  let changed = false;
  let dropped = false;
  let chars = urlChars(current);
  const urls = [...current];
  const indexes = new Map(urls.map(({ url }, index) => [url, index]));
  for (const entry of reported) {
    const index = indexes.get(entry.url);
    if (index === undefined) {
      if (chars + entry.url.length > MAX_BLOCKED_URL_CHARS) {
        dropped = true;
        continue;
      }
      indexes.set(entry.url, urls.length);
      urls.push({ url: entry.url, count: entry.count });
      chars += entry.url.length;
      changed = true;
    } else if (entry.count > urls[index].count) {
      urls[index] = { url: entry.url, count: entry.count };
      changed = true;
    }
  }
  return { urls: changed ? urls : current, dropped };
}
