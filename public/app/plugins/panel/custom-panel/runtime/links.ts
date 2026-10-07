import { MAX_HREF_LENGTH } from './constants';

export type RenderLinkParams = Record<string, string | string[]>;

export type RenderLinkTarget =
  | { kind: 'view-panel'; panelId: number }
  | { kind: 'explore-panel'; panelId: number }
  | { kind: 'focus-panel'; panelId: number }
  | { kind: 'dashboard-state'; params: RenderLinkParams }
  | { kind: 'dashboard'; path: string; params: RenderLinkParams };

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const VIEW_PANEL_HASH = /^#panel-(\d{1,9})$/;
const EXPLORE_PANEL_HASH = /^#explore-panel-(\d{1,9})$/;
const FOCUS_PANEL_HASH = /^#focus-panel-(\d{1,9})$/;
const DASHBOARD_PATH = /^\/d\/([^/?#]*)(?:\/([^/?#]*))?(?:\?([^#]*))?$/;
const UID = /^[a-zA-Z0-9_-]{1,40}$/;
const SLUG = /^[a-zA-Z0-9_-]{0,200}$/;
const PANEL_KEY_VALUE = /^panel-\d{1,9}$/;
const TIME_VALUE = /^[\w\-+:./ ]{1,64}$/;
const VARIABLE_KEY = /^var-([\w-]{1,100})$/;
const MAX_VARIABLE_VALUE_LENGTH = 512;
const TAB_KEY = /^([a-z0-9-]+-)?dtab$/i;
const TAB_VALUE = /^[a-z0-9-]{1,100}$/i;
const MAX_NAMED_REFUSED_LINKS = 5;
const MAX_NAMED_LINK_LENGTH = 120;

/**
 * Decides what a link requested by the frame may do. Only same-dashboard state, actions on a panel
 * of this dashboard and relative dashboard URLs pass, with an allowlist of query parameters;
 * everything else is refused. Panel actions carry only the panel id: Grafana resolves the rest
 * (queries, datasource, time range) from the dashboard, never from the frame.
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

  const explorePanel = EXPLORE_PANEL_HASH.exec(value);
  if (explorePanel) {
    return { kind: 'explore-panel', panelId: Number(explorePanel[1]) };
  }

  const focusPanel = FOCUS_PANEL_HASH.exec(value);
  if (focusPanel) {
    return { kind: 'focus-panel', panelId: Number(focusPanel[1]) };
  }

  if (value.startsWith('?')) {
    // editPanel only on this dashboard, where the host can check that the user may edit it.
    const params = parseParams(value.slice(1), { allowEditPanel: true });
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

/**
 * Explains, for the draw status, which of these links Grafana will not follow and which ones it
 * does. Undefined when it follows all of them.
 */
export function describeRefusedLinks(hrefs: string[]): string | undefined {
  const refused = [...new Set(hrefs)].filter((href) => validateRenderLink(href) === null);
  if (refused.length === 0) {
    return undefined;
  }
  const named = refused
    .slice(0, MAX_NAMED_REFUSED_LINKS)
    .map((href) =>
      JSON.stringify(href.length > MAX_NAMED_LINK_LENGTH ? `${href.slice(0, MAX_NAMED_LINK_LENGTH - 1)}…` : href)
    );
  const more = refused.length > named.length ? ` and ${refused.length - named.length} more` : '';
  return (
    `Grafana will not follow ${refused.length === 1 ? 'this link' : 'these links'}: ${named.join(', ')}${more}. ` +
    'It follows only #panel-<id>, #explore-panel-<id> and #focus-panel-<id> for a panel of this dashboard, ' +
    '?<params> for this dashboard and /d/<uid>[/<slug>][?<params>] for another dashboard, with the parameters ' +
    'viewPanel, editPanel, from, to, var-<name> and tab keys (dtab).'
  );
}

/** Returns null when any key or value is outside the allowlist; one bad key rejects the link. */
function parseParams(query: string, { allowEditPanel = false } = {}): RenderLinkParams | null {
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
    const allowed =
      key === 'editPanel' ? allowEditPanel && PANEL_KEY_VALUE.test(paramValue) : isAllowedSingleParam(key, paramValue);
    if (!allowed || Object.prototype.hasOwnProperty.call(params, key)) {
      return null;
    }
    params[key] = paramValue;
  }
  // The dashboard cannot view and edit a panel at the same time.
  if ('editPanel' in params && 'viewPanel' in params) {
    return null;
  }
  return params;
}

function isAllowedSingleParam(key: string, value: string): boolean {
  if (key === 'viewPanel') {
    return PANEL_KEY_VALUE.test(value);
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
