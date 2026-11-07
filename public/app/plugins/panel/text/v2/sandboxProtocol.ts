import type { MermaidConfig } from 'mermaid';

import type { getMarkdownAlertTitles } from '@grafana/ui/internal';

import {
  MAX_BLOCKED_URL_CHARS,
  MAX_BLOCKED_URL_COUNT,
  urlChars,
  type BlockedResource,
  type BlockedUrl,
} from './sandboxPolicy';

export const TEXT_FRAME_PROTOCOL = 'grafana-text-frame-v1';
export const CSP_CHECK_URL = 'https://grafana-csp-check.invalid/';

export function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join(
    ''
  );
}

export interface RenderCommand {
  protocol: typeof TEXT_FRAME_PROTOCOL;
  channel: string;
  type: 'render';
  html: string;
  globalCss: string;
  mermaid?: MermaidConfig;
  diagramError: string;
  admonitions?: {
    theme: string;
    titles: ReturnType<typeof getMarkdownAlertTitles>;
  };
}

export interface MermaidCommand {
  protocol: typeof TEXT_FRAME_PROTOCOL;
  channel: string;
  type: 'mermaid-source';
  source: string;
}

export interface AdmonitionsCommand {
  protocol: typeof TEXT_FRAME_PROTOCOL;
  channel: string;
  type: 'admonitions-source';
  source: string;
}

export type FrameNotification =
  | { type: 'ready'; document: string }
  | { type: 'rendered' | 'error' | 'mermaid-needed' | 'admonitions-needed' }
  | { type: 'resize'; height: number; contentHeight: number }
  | { type: 'blocked'; resources: BlockedResource[] };

export function isFrameNotification(
  value: unknown
): value is FrameNotification & { protocol: string; channel: string } {
  if (
    !value ||
    typeof value !== 'object' ||
    !('protocol' in value) ||
    value.protocol !== TEXT_FRAME_PROTOCOL ||
    !('channel' in value) ||
    typeof value.channel !== 'string' ||
    !('type' in value)
  ) {
    return false;
  }
  switch (value.type) {
    case 'ready':
      return 'document' in value && typeof value.document === 'string';
    case 'rendered':
    case 'error':
    case 'mermaid-needed':
    case 'admonitions-needed':
      return true;
    case 'resize':
      return (
        'height' in value &&
        typeof value.height === 'number' &&
        Number.isFinite(value.height) &&
        value.height >= 1 &&
        value.height <= 10_000_000 &&
        'contentHeight' in value &&
        typeof value.contentHeight === 'number' &&
        Number.isFinite(value.contentHeight) &&
        value.contentHeight >= 0 &&
        value.contentHeight <= 10_000_000
      );
    case 'blocked':
      return (
        'resources' in value &&
        Array.isArray(value.resources) &&
        value.resources.length > 0 &&
        value.resources.every(
          (resource) =>
            resource &&
            typeof resource.directive === 'string' &&
            (resource.origin === undefined || typeof resource.origin === 'string') &&
            (resource.urls === undefined || isBlockedUrls(resource.urls)) &&
            (resource.truncated === undefined || typeof resource.truncated === 'boolean')
        )
      );
    default:
      return false;
  }
}

function isBlockedUrls(value: unknown): value is BlockedUrl[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry.url === 'string' &&
        Number.isInteger(entry.count) &&
        entry.count >= 1 &&
        entry.count <= MAX_BLOCKED_URL_COUNT
    ) &&
    urlChars(value) <= MAX_BLOCKED_URL_CHARS
  );
}
