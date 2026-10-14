import type { MermaidConfig } from 'mermaid';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

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
import { isFrameNotification, TEXT_FRAME_PROTOCOL, type RenderCommand, type MermaidCommand } from './sandboxProtocol';

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
  // An applied CSP cannot be relaxed in place; policy changes need a fresh document.
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
  const [state, setState] = useState<TextSandboxState>({ status: 'loading', resources: [] });
  const [size, setSize] = useState({ height: 1, contentHeight: 0 });
  const [source, setSource] = useState<string>();
  const [channel] = useState(randomChannel);
  // srcdoc inherits deployment CSP, so reuse Grafana's server nonce when one is present.
  const [nonce] = useState(() => document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || randomChannel());
  const appliedPolicy = policy?.replace("script-src 'none'", `script-src 'nonce-${nonce}'`);
  const protectedFrame = policy !== undefined;

  useLayoutEffect(() => {
    onState(state);
  }, [onState, state]);
  useLayoutEffect(() => () => onState(undefined), [onState]);
  useLayoutEffect(() => {
    if (size.contentHeight > 0) {
      onHeight(size.height, size.contentHeight);
    }
  }, [onHeight, size]);

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
          setState((current) => ({ ...current, status: 'error' }));
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  useLayoutEffect(() => {
    let sent = false;
    let disposed = false;
    let mermaidRequested = false;
    let failed = false;
    const fail = () => {
      failed = true;
      setState((current) => ({ ...current, status: 'error' }));
    };
    const watchdog = window.setTimeout(fail, 15000);
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
        case 'mermaid-needed': {
          if (!sent || failed || !mermaid || mermaidRequested) {
            return;
          }
          mermaidRequested = true;
          const target = frame.current.contentWindow;
          void loadSandboxMermaid()
            .then((source) => {
              if (disposed || failed || !target || frame.current?.contentWindow !== target) {
                return;
              }
              const command: MermaidCommand = {
                protocol: TEXT_FRAME_PROTOCOL,
                channel,
                type: 'mermaid-source',
                source,
              };
              target.postMessage(command, protectedFrame ? '*' : window.location.origin);
            })
            .catch(() => {
              if (!disposed) {
                clearTimeout(watchdog);
                fail();
              }
            });
          break;
        }
        case 'ready': {
          // Protected frames send ready only after verifying CSP violation delivery, before receiving panel data.
          if (sent || failed) {
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
          if (sent && !failed) {
            clearTimeout(watchdog);
            setState((current) => ({ ...current, status: 'ready' }));
          }
          break;
        case 'resize':
          if (sent) {
            setSize({ height: message.height, contentHeight: message.contentHeight });
          }
          break;
        case 'blocked':
          if (!sent) {
            break;
          }
          setState((current) => {
            const resources = mergeResources(current.resources, message.resources);
            return resources === current.resources ? current : { ...current, resources };
          });
          break;
        case 'error':
          clearTimeout(watchdog);
          fail();
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      disposed = true;
      clearTimeout(watchdog);
      window.removeEventListener('message', onMessage);
    };
  }, [channel, diagramError, globalCss, html, mermaid, protectedFrame]);

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
      data-text-content-height={size.contentHeight || undefined}
      style={{
        width: '100%',
        height: size.height,
        border: 0,
      }}
      // An empty srcdoc can race the runtime navigation and leave Chromium on a blank document.
      srcDoc={shell}
    />
  );
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
