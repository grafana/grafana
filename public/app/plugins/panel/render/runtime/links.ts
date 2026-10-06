import { MAX_HREF_LENGTH } from './constants';

export type RenderLinkParams = Record<string, string | string[]>;

export type RenderLinkTarget =
  | { kind: 'view-panel'; panelId: number }
  | { kind: 'dashboard-state'; params: RenderLinkParams }
  | { kind: 'dashboard'; path: string; params: RenderLinkParams };

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const VIEW_PANEL_HASH = /^#panel-(\d{1,9})$/;
const DASHBOARD_PATH = /^\/d\/([^/?#]*)(?:\/([^/?#]*))?(?:\?([^#]*))?$/;
const UID = /^[a-zA-Z0-9_-]{1,40}$/;
const SLUG = /^[a-zA-Z0-9_-]{0,200}$/;
const VIEW_PANEL_VALUE = /^panel-\d+$/;
const TIME_VALUE = /^[\w\-+:./ ]{1,64}$/;
const VARIABLE_KEY = /^var-([\w-]{1,100})$/;
const MAX_VARIABLE_VALUE_LENGTH = 512;
const TAB_KEY = /^([a-z0-9-]+-)?dtab$/i;
const TAB_VALUE = /^[a-z0-9-]{1,100}$/i;

/**
 * Decides what a link requested by the frame may do. Only same-dashboard state and relative
 * dashboard URLs pass, with an allowlist of query parameters; everything else is refused.
 */
export function validateRenderLink(href: string): RenderLinkTarget | null {
  if (typeof href !== 'string') {
    return null;
  }
  const value = href.trim();
  if (
    value.length === 0 ||
    value.length > MAX_HREF_LENGTH ||
    CONTROL_CHARACTERS.test(value) ||
    value.includes('\\') ||
    value.startsWith('//') ||
    SCHEME.test(value)
  ) {
    return null;
  }

  const viewPanel = VIEW_PANEL_HASH.exec(value);
  if (viewPanel) {
    return { kind: 'view-panel', panelId: Number(viewPanel[1]) };
  }

  if (value.startsWith('?')) {
    const params = parseParams(value.slice(1));
    return params && Object.keys(params).length > 0 ? { kind: 'dashboard-state', params } : null;
  }

  const dashboard = DASHBOARD_PATH.exec(value);
  if (dashboard) {
    const [, uid, slug, query] = dashboard;
    if (!UID.test(uid) || (slug !== undefined && !SLUG.test(slug))) {
      return null;
    }
    const params = parseParams(query ?? '');
    if (!params) {
      return null;
    }
    return { kind: 'dashboard', path: slug ? `/d/${uid}/${slug}` : `/d/${uid}`, params };
  }

  return null;
}

/** Returns null when any key or value is outside the allowlist; one bad key rejects the link. */
function parseParams(query: string): RenderLinkParams | null {
  const params: RenderLinkParams = {};
  if (query === '') {
    return params;
  }
  let search: URLSearchParams;
  try {
    search = new URLSearchParams(query);
  } catch {
    return null;
  }
  for (const [key, paramValue] of search) {
    if (VARIABLE_KEY.test(key)) {
      if (paramValue.length > MAX_VARIABLE_VALUE_LENGTH) {
        return null;
      }
      const existing = params[key];
      params[key] = existing === undefined ? paramValue : [...toArray(existing), paramValue];
      continue;
    }
    if (!isAllowedSingleParam(key, paramValue) || Object.prototype.hasOwnProperty.call(params, key)) {
      return null;
    }
    params[key] = paramValue;
  }
  return params;
}

function isAllowedSingleParam(key: string, value: string): boolean {
  if (key === 'viewPanel') {
    return VIEW_PANEL_VALUE.test(value);
  }
  if (key === 'from' || key === 'to') {
    return TIME_VALUE.test(value);
  }
  if (TAB_KEY.test(key)) {
    return TAB_VALUE.test(value);
  }
  return false;
}

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}
