import type { MermaidConfig } from 'mermaid';

import type { BlockedResource } from './sandboxPolicy';

export const TEXT_FRAME_PROTOCOL = 'grafana-text-frame-v1';
export const CSP_CHECK_URL = 'https://grafana-csp-check.invalid/';

export interface RenderCommand {
  protocol: typeof TEXT_FRAME_PROTOCOL;
  channel: string;
  type: 'render';
  html: string;
  globalCss: string;
  mermaid?: MermaidConfig;
  diagramError: string;
}

export interface MermaidCommand {
  protocol: typeof TEXT_FRAME_PROTOCOL;
  channel: string;
  type: 'mermaid-source';
  source: string;
}

export type FrameNotification =
  | { type: 'ready' | 'rendered' | 'error' | 'mermaid-needed' }
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
    case 'rendered':
    case 'error':
    case 'mermaid-needed':
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
            (resource.origin === undefined || typeof resource.origin === 'string')
        )
      );
    default:
      return false;
  }
}
