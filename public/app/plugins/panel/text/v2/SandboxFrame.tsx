import type { MermaidConfig } from 'mermaid';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { textUtil } from '@grafana/data';

import { loadSandboxRuntime } from './loadSandboxRuntime';
import { resourceOrigin, type TextSandboxState } from './sandboxPolicy';
import { isFrameNotification, TEXT_FRAME_PROTOCOL, type RenderCommand } from './sandboxProtocol';

export interface SandboxFrameProps {
  /** Sanitized when protected; legacy HTML respects the administrator's sanitizer setting. */
  html: string;
  globalCss: string;
  /** Omitted, not empty, for panels without dataframes. */
  policy?: string;
  mermaid?: MermaidConfig;
  diagramError?: string;
  title: string;
  onState: (state: TextSandboxState) => void;
  onHeight: (height: number, contentHeight: number) => void;
}

function randomChannel() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join(
    ''
  );
}

export function SandboxFrame(props: SandboxFrameProps) {
  const { html, globalCss, policy, mermaid, diagramError } = props;
  const [generation, setGeneration] = useState({ html, globalCss, policy, mermaid, diagramError, id: 0 });
  if (
    generation.html !== html ||
    generation.globalCss !== globalCss ||
    generation.policy !== policy ||
    generation.mermaid !== mermaid ||
    generation.diagramError !== diagramError
  ) {
    setGeneration({ html, globalCss, policy, mermaid, diagramError, id: generation.id + 1 });
  }
  // Never relax a document that has already received datasource content.
  return <FrameDocument key={generation.id} {...props} />;
}

function FrameDocument({
  html,
  globalCss,
  policy,
  mermaid,
  diagramError = 'Diagram could not be rendered',
  title,
  onState,
  onHeight,
}: SandboxFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<TextSandboxState>({ status: 'loading' });
  const [hidden, setHidden] = useState(true);
  const [size, setSize] = useState({ height: 1, contentHeight: 0 });
  const [source, setSource] = useState<string>();
  const [channel] = useState(randomChannel);
  // srcdoc inherits deployment CSP, so reuse Grafana's server nonce when one is present.
  const [nonce] = useState(() => document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || randomChannel());
  const appliedPolicy = policy?.replace("script-src 'none'", `script-src 'nonce-${nonce}'`);
  const protectedFrame = policy !== undefined;
  const terminal = state.status === 'blocked' || state.status === 'error';

  useLayoutEffect(() => {
    onState(state);
  }, [onState, state]);
  useLayoutEffect(() => {
    if (size.contentHeight > 0 && !terminal) {
      onHeight(size.height, size.contentHeight);
    }
  }, [onHeight, size, terminal]);

  useLayoutEffect(() => {
    let disposed = false;
    void loadSandboxRuntime()
      .then((source) => {
        if (!disposed) {
          setSource(source);
        }
      })
      .catch(() => {
        if (!disposed) {
          setState({ status: 'error' });
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (terminal) {
      return;
    }
    let sent = false;
    let blocked = false;
    const watchdog = window.setTimeout(() => setState({ status: 'error' }), 15000);
    const onMessage = (event: MessageEvent) => {
      const message = event.data;
      if (
        !frame.current ||
        event.source !== frame.current.contentWindow ||
        event.origin !== (protectedFrame ? 'null' : window.location.origin) ||
        !isFrameNotification(message) ||
        message.channel !== channel
      ) {
        return;
      }
      switch (message.type) {
        case 'ready': {
          if (sent) {
            return;
          }
          sent = true;
          const command: RenderCommand = {
            protocol: TEXT_FRAME_PROTOCOL,
            channel,
            type: 'render',
            html,
            globalCss,
            mermaid,
            diagramError,
          };
          // Opaque-origin frames require '*'; target only this generation's WindowProxy.
          frame.current.contentWindow?.postMessage(command, protectedFrame ? '*' : window.location.origin);
          break;
        }
        case 'rendered':
          if (sent && !blocked) {
            clearTimeout(watchdog);
            setHidden(false);
            setState({ status: 'ready' });
          }
          break;
        case 'resize':
          if (sent && !blocked) {
            setSize({ height: message.height, contentHeight: message.contentHeight });
          }
          break;
        case 'hide':
          blocked = true;
          setHidden(true);
          setState({ status: 'loading' });
          break;
        case 'blocked':
          blocked = true;
          clearTimeout(watchdog);
          setState({
            status: 'blocked',
            resources: message.resources.map((resource) => ({
              directive: resource.directive,
              origin: resource.origin ? resourceOrigin(resource.origin) : undefined,
            })),
          });
          break;
        case 'error':
          if (!blocked) {
            setState({ status: 'error' });
          }
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      clearTimeout(watchdog);
      window.removeEventListener('message', onMessage);
    };
  }, [channel, diagramError, globalCss, html, mermaid, protectedFrame, terminal]);

  const shell = useMemo(() => {
    if (source === undefined) {
      return undefined;
    }
    const escape = textUtil.escapeHtml;
    const csp =
      appliedPolicy === undefined
        ? ''
        : `<meta http-equiv="Content-Security-Policy" content="${escape(appliedPolicy)}">`;
    const policyAttribute = appliedPolicy === undefined ? '' : ` data-policy="${escape(appliedPolicy)}"`;
    return `<!doctype html><html><head>${csp}<base target="_blank"></head><body><script nonce="${escape(nonce)}" data-channel="${escape(channel)}" data-parent-origin="${escape(window.location.origin)}"${policyAttribute}>${source.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  }, [appliedPolicy, channel, nonce, source]);
  if (terminal || shell === undefined) {
    return null;
  }
  return (
    <iframe
      ref={frame}
      title={title}
      sandbox={
        protectedFrame
          ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation'
          : undefined
      }
      referrerPolicy={protectedFrame ? 'no-referrer' : undefined}
      aria-hidden={hidden ? true : undefined}
      tabIndex={hidden ? -1 : undefined}
      data-text-content-height={size.contentHeight || undefined}
      style={{
        position: hidden ? 'absolute' : 'static',
        visibility: hidden ? 'hidden' : 'visible',
        pointerEvents: hidden ? 'none' : 'auto',
        width: '100%',
        height: size.height,
        border: 0,
      }}
      srcDoc={shell}
    />
  );
}
