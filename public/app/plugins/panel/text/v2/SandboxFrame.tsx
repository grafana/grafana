import type { MermaidConfig } from 'mermaid';
import { useLayoutEffect, useRef, useState } from 'react';

import { textUtil } from '@grafana/data';

import { loadSandboxMermaid, loadSandboxRuntime } from './loadSandboxRuntime';
import { resourceOrigin, type BlockedResource, type TextSandboxState } from './sandboxPolicy';
import { isFrameNotification, TEXT_FRAME_PROTOCOL, type RenderCommand, type MermaidCommand } from './sandboxProtocol';

const WATCHDOG_TIMEOUT_MS = 15_000;

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
  const { iframeRef, sandboxState, dimensions } = useFrameRuntime(props);
  const protectedFrame = props.policy !== undefined;

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
  const [channel] = useState(randomChannel);
  // srcdoc inherits deployment CSP, so reuse Grafana's server nonce when one is present.
  const [nonce] = useState(() => document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || randomChannel());
  const protectedFrame = policy !== undefined;

  // Install the listener and start its timeout before loading the runtime, so bootstrap hangs are covered too.
  // This stays separate from reporting effects, whose changing consumers must not reset the controller.
  useLayoutEffect(() => {
    if (!iframeRef.current) {
      return;
    }
    const controller = createFrameController({
      iframe: iframeRef.current,
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
      onStatus: (status) => setSandboxState((current) => ({ ...current, status })),
      onResize: setDimensions,
      onBlocked: (incoming) =>
        setSandboxState((current) => {
          const resources = mergeBlockedResources(current.resources, incoming);
          return resources === current.resources ? current : { ...current, resources };
        }),
    });
    return controller.dispose;
  }, [channel, diagramError, globalCss, html, mermaid, protectedFrame]);

  // Bootstrap and listening could share an effect, but keeping them separate isolates navigation from protocol setup.
  // Preserve their order: the controller must be listening before srcdoc can execute and send ready.
  useLayoutEffect(() => {
    let disposed = false;
    void loadSandboxRuntime()
      .then((runtimeSource) => {
        if (disposed || !iframeRef.current) {
          return;
        }
        // Do not navigate to an empty srcdoc: it can race the runtime navigation in Chromium.
        const shell = buildFrameShell({
          runtimeSource,
          policy,
          nonce,
          channel,
          parentOrigin: window.location.origin,
        });
        assignFrameShell(iframeRef.current, shell);
      })
      .catch(() => {
        if (!disposed) {
          setSandboxState((current) => ({ ...current, status: 'error' }));
        }
      });
    return () => {
      disposed = true;
    };
  }, [channel, nonce, policy]);

  return { iframeRef, sandboxState, dimensions };
}

interface FrameControllerOptions {
  iframe: HTMLIFrameElement;
  protectedFrame: boolean;
  renderCommand: RenderCommand;
  onStatus: (status: TextSandboxState['status']) => void;
  onResize: (dimensions: { height: number; contentHeight: number }) => void;
  onBlocked: (resources: BlockedResource[]) => void;
}

function createFrameController({
  iframe,
  protectedFrame,
  renderCommand,
  onStatus,
  onResize,
  onBlocked,
}: FrameControllerOptions) {
  // Protocol guards update synchronously, independently of React's reported state.
  let renderCommandSent = false;
  let hasFailed = false;
  let mermaidRequested = false;
  let disposed = false;
  const expectedOrigin = protectedFrame ? 'null' : window.location.origin;
  // Opaque-origin frames require '*'; commands still target only this document's WindowProxy.
  const targetOrigin = protectedFrame ? '*' : window.location.origin;
  // if the iframe takes more than 15s to initialize, mark it as failed to avoid a permament hang.
  const watchdog = window.setTimeout(fail, WATCHDOG_TIMEOUT_MS);
  window.addEventListener('message', onMessage);

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
        return sendRender();
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

  function sendRender() {
    // Protected frames verify CSP violation delivery before sending ready and receiving panel data.
    if (renderCommandSent || hasFailed) {
      return;
    }
    renderCommandSent = true;
    iframe.contentWindow?.postMessage(renderCommand, targetOrigin);
  }

  function loadRequestedMermaid() {
    if (!renderCommandSent || hasFailed || !renderCommand.mermaid || mermaidRequested) {
      return;
    }
    mermaidRequested = true;
    const target = iframe.contentWindow;
    void loadSandboxMermaid()
      .then((source) => {
        if (disposed || hasFailed || !target || iframe.contentWindow !== target) {
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
        if (!disposed) {
          fail();
        }
      });
  }

  function markRendered() {
    if (renderCommandSent && !hasFailed) {
      clearTimeout(watchdog);
      onStatus('ready');
    }
  }

  // Content can still resize or report violations after a rendering failure.
  function updateDimensions(height: number, contentHeight: number) {
    if (renderCommandSent) {
      onResize({ height, contentHeight });
    }
  }

  function recordBlockedResources(resources: BlockedResource[]) {
    if (renderCommandSent) {
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

  return `<!doctype html>
<html>
  <head>
    ${cspMeta}
    <base target="_blank">
  </head>
  <body>
    <script
      nonce="${escape(nonce)}"
      data-channel="${escape(channel)}"
      data-parent-origin="${escape(parentOrigin)}"${policyAttribute}
    >${scriptSource}</script>
  </body>
</html>`;
}

function assignFrameShell(iframe: HTMLIFrameElement, shell: string) {
  // Only the application-built shell reaches this policy; panel HTML arrives later by message.
  shellPolicy ??= window.trustedTypes?.createPolicy('grafana-text-panel-shell', {
    createHTML: (html: string) => html,
  });
  // React stringifies srcDoc, discarding TrustedHTML. Assign it directly without changing the default policy.
  Object.assign(iframe, { srcdoc: shellPolicy?.createHTML(shell) ?? shell });
}

function mergeBlockedResources(current: BlockedResource[], incoming: BlockedResource[]): BlockedResource[] {
  const resources = [...current];
  for (const resource of incoming) {
    const normalized = {
      directive: resource.directive,
      origin: resource.origin ? resourceOrigin(resource.origin) : undefined,
    };
    if (!resources.some((entry) => entry.directive === normalized.directive && entry.origin === normalized.origin)) {
      resources.push(normalized);
    }
  }
  return resources.length === current.length ? current : resources;
}

function randomChannel() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join(
    ''
  );
}
