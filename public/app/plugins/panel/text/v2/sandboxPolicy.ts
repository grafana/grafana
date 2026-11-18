export interface BlockedUrl {
  url: string;
  /** How many elements use the URL. Browsers may report a repeated image only once. */
  count: number;
}

export interface BlockedResource {
  directive: string;
  origin?: string;
  /** Only set when the viewer can allow the origin. */
  urls?: BlockedUrl[];
  /** The URLs went over MAX_BLOCKED_URL_CHARS, so `urls` is incomplete. */
  truncated?: boolean;
}

// Limits on what the parent accepts from the untrusted frame, so a flood of reports can't stall the page.
// A source over the budget is marked truncated, never listed in part.
export const MAX_BLOCKED_URL_CHARS = 256 * 1024;
export const MAX_BLOCKED_URL_COUNT = 1_000_000;

export function urlChars(urls: BlockedUrl[]): number {
  return urls.reduce((sum, { url }) => sum + url.length, 0);
}

export interface TextSandboxState {
  status: 'loading' | 'ready' | 'error';
  resources: BlockedResource[];
}

export const RESOURCE_DIRECTIVES = new Set([
  'img-src',
  'media-src',
  'font-src',
  'style-src',
  'style-src-elem',
  'frame-src',
]);

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
    `font-src data: ${fontSource} ${sources}`,
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
