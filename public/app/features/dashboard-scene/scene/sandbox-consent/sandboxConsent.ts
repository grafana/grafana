import { useSyncExternalStore } from 'react';

import { store } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

export type ConsentScope = 'dashboard' | 'always';

interface BlockedUrl {
  url: string;
  count: number;
}

export interface BlockedOrigin {
  origin: string;
  urls: BlockedUrl[];
  /** More URLs were blocked than could be listed, so the viewer can't review the source. */
  truncated?: boolean;
}

export interface PanelBlockedReport {
  dashboardUid?: string;
  panelId?: number;
  panelTitle: string;
  origins: BlockedOrigin[];
}

export interface BlockedOriginSummary extends BlockedOrigin {
  host: string;
  panels: string[];
  /** The panels "Allow" applies to. */
  panelIds: Array<number | undefined>;
  count: number;
}

export type ConsentGrant = Pick<BlockedOriginSummary, 'origin' | 'panelIds'>;

const hostCollator = new Intl.Collator();

const STORAGE_KEY = 'grafana.sandbox.allowedOrigins';

// The default login lifetime. The frontend can't read the configured one.
export const ALWAYS_ALLOW_DAYS = 30;
const ALWAYS_ALLOW_MS = ALWAYS_ALLOW_DAYS * 24 * 60 * 60 * 1000;
// setTimeout fires straight away for longer delays.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

interface AllowedOrigins {
  key: string;
  /** "Always allow", as origin to expiry time. Kept in localStorage. */
  always: Map<string, number>;
  expiryTimer?: ReturnType<typeof setTimeout>;
  /**
   * "Allow", per panel. A panel that wasn't rendered when the viewer allowed a source wasn't reviewed,
   * so it isn't covered. Kept in sessionStorage, so it ends when the tab closes.
   */
  byPanel: Map<string, Set<string>>;
}

const listeners = new Set<() => void>();
const allowedByUser = new Map<string, AllowedOrigins>();
const reports = new Map<string, PanelBlockedReport>();
// useSyncExternalStore needs a stable snapshot between changes.
const allowedSnapshots = new Map<string, string[]>();
const summarySnapshots = new Map<string, BlockedOriginSummary[]>();

function allowedForUser(): AllowedOrigins {
  // Storage survives logout and org switches, so each user and org gets its own key.
  const key = `${STORAGE_KEY}.${contextSrv.user.orgId}.${contextSrv.user.id}`;
  const existing = allowedByUser.get(key);
  if (existing) {
    return existing;
  }
  const stored = tryStorage(() => JSON.parse(window.sessionStorage.getItem(key) ?? '{}'), {});
  const allowed: AllowedOrigins = {
    key,
    always: readAlways(key),
    byPanel: new Map(Object.entries(stored ?? {}).map(([panel, origins]) => [panel, new Set(toOrigins(origins))])),
  };
  allowedByUser.set(key, allowed);
  scheduleExpiry(allowed);
  // Picks up "Always allow" from other tabs.
  store.subscribe(key, () => {
    allowed.always = readAlways(key);
    scheduleExpiry(allowed);
    emit(true);
  });
  return allowed;
}

function readAlways(key: string) {
  const stored = tryStorage(() => store.getObject(key), undefined);
  const always = new Map<string, number>();
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const [origin, expiresAt] of Object.entries(stored)) {
      if (typeof expiresAt === 'number' && expiresAt > Date.now()) {
        always.set(origin, expiresAt);
      }
    }
  }
  return always;
}

// Dashboards on a TV can stay open for longer than the expiry.
function scheduleExpiry(allowed: AllowedOrigins) {
  clearTimeout(allowed.expiryTimer);
  allowed.expiryTimer = undefined;
  if (allowed.always.size === 0) {
    return;
  }
  const earliest = Math.min(...allowed.always.values());
  allowed.expiryTimer = setTimeout(
    () => {
      const now = Date.now();
      const expired = [...allowed.always].filter(([, expiresAt]) => expiresAt <= now);
      expired.forEach(([origin]) => allowed.always.delete(origin));
      scheduleExpiry(allowed);
      if (expired.length > 0) {
        emit(true);
      }
    },
    Math.min(Math.max(earliest - Date.now(), 0), MAX_TIMEOUT_MS)
  );
}

function toOrigins(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((origin): origin is string => typeof origin === 'string') : [];
}

// Storage can be blocked (private mode, blocked site data). Consent then lasts until the page reloads.
function tryStorage<T>(access: () => T, fallback: T): T {
  try {
    return access();
  } catch {
    return fallback;
  }
}

function panelKey(dashboardUid: string, panelId?: number) {
  return `${dashboardUid}/${panelId ?? ''}`;
}

// Reports don't change what is allowed, so they keep the allowed snapshots and don't re-render every panel.
function emit(allowedChanged = false) {
  if (allowedChanged) {
    allowedSnapshots.clear();
  }
  summarySnapshots.clear();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAllowedOrigins(dashboardUid = '', panelId?: number): string[] {
  const { always, byPanel } = allowedForUser();
  return [...new Set([...always.keys(), ...(byPanel.get(panelKey(dashboardUid, panelId)) ?? [])])].sort();
}

export function allowOrigins(grants: ConsentGrant[], scope: ConsentScope, dashboardUid = '') {
  if (grants.length === 0) {
    return;
  }
  const allowed = allowedForUser();
  const { key, always, byPanel } = allowed;
  if (scope === 'always') {
    const expiresAt = Date.now() + ALWAYS_ALLOW_MS;
    grants.forEach(({ origin }) => always.set(origin, expiresAt));
    tryStorage(() => store.setObject(key, Object.fromEntries(always)), false);
    scheduleExpiry(allowed);
  } else {
    for (const { origin, panelIds } of grants) {
      for (const panelId of panelIds) {
        const panel = panelKey(dashboardUid, panelId);
        byPanel.set(panel, (byPanel.get(panel) ?? new Set()).add(origin));
      }
    }
    storeByPanel(allowed);
  }
  emit(true);
}

function storeByPanel({ key, byPanel }: AllowedOrigins) {
  const stored = Object.fromEntries(Array.from(byPanel, ([panel, set]) => [panel, [...set]]));
  tryStorage(() => window.sessionStorage.setItem(key, JSON.stringify(stored)), undefined);
}

/**
 * Carries "Allow" over when a new dashboard is first saved and gets its uid. Copied, not moved, as panels
 * keep the old uid until their queries run again.
 */
export function copyDashboardConsent(fromUid: string, toUid: string) {
  const allowed = allowedForUser();
  const prefix = panelKey(fromUid);
  let copied = false;
  for (const [panel, origins] of [...allowed.byPanel]) {
    if (panel.startsWith(prefix)) {
      const target = panelKey(toUid) + panel.slice(prefix.length);
      allowed.byPanel.set(target, new Set([...(allowed.byPanel.get(target) ?? []), ...origins]));
      copied = true;
    }
  }
  if (copied) {
    storeByPanel(allowed);
    emit(true);
  }
}

/** A new dashboard has no uid, so it would otherwise inherit "Allow" from the last unsaved one. */
export function clearUnsavedDashboardConsent() {
  const allowed = allowedForUser();
  const prefix = panelKey('');
  const unsaved = [...allowed.byPanel.keys()].filter((panel) => panel.startsWith(prefix));
  if (unsaved.length > 0) {
    unsaved.forEach((panel) => allowed.byPanel.delete(panel));
    storeByPanel(allowed);
    emit(true);
  }
}

export function reportBlocked(key: string, report: PanelBlockedReport) {
  if (report.origins.length === 0) {
    clearBlocked(key);
    return;
  }
  reports.set(key, report);
  emit();
}

export function clearBlocked(key: string) {
  if (reports.delete(key)) {
    emit();
  }
}

/** Pass `panelId` to only include that panel, as the panel editor does. */
export function getBlockedSummary(dashboardUid = '', panelId?: number): BlockedOriginSummary[] {
  const byOrigin = new Map<
    string,
    { panels: Set<string>; panelIds: Set<number | undefined>; urls: Map<string, number>; truncated: boolean }
  >();
  for (const report of reports.values()) {
    if ((report.dashboardUid ?? '') !== dashboardUid || (panelId !== undefined && report.panelId !== panelId)) {
      continue;
    }
    const allowed = new Set(getAllowedOrigins(dashboardUid, report.panelId));
    for (const { origin, urls, truncated } of report.origins) {
      // A report can outlive the consent until the panel's frame re-renders with the new policy.
      if (allowed.has(origin)) {
        continue;
      }
      const entry = byOrigin.get(origin) ?? {
        panels: new Set(),
        panelIds: new Set(),
        urls: new Map(),
        truncated: false,
      };
      entry.panels.add(report.panelTitle);
      entry.panelIds.add(report.panelId);
      entry.truncated ||= Boolean(truncated);
      for (const { url, count } of urls) {
        entry.urls.set(url, (entry.urls.get(url) ?? 0) + count);
      }
      byOrigin.set(origin, entry);
    }
  }
  return Array.from(byOrigin, ([origin, { panels, panelIds, urls, truncated }]) => ({
    origin,
    host: new URL(origin).host,
    panels: [...panels],
    panelIds: [...panelIds],
    urls: Array.from(urls, ([url, count]) => ({ url, count })),
    ...(truncated && { truncated }),
    count: Math.max(
      1,
      Array.from(urls.values()).reduce((sum, count) => sum + count, 0)
    ),
  })).sort((a, b) => b.count - a.count || hostCollator.compare(a.host, b.host));
}

export function useAllowedOrigins(dashboardUid = '', panelId?: number): string[] {
  return useSyncExternalStore(subscribe, () => {
    const key = panelKey(dashboardUid, panelId);
    const snapshot = allowedSnapshots.get(key) ?? getAllowedOrigins(dashboardUid, panelId);
    allowedSnapshots.set(key, snapshot);
    return snapshot;
  });
}

export function useBlockedSummary(dashboardUid = '', panelId?: number): BlockedOriginSummary[] {
  return useSyncExternalStore(subscribe, () => {
    const key = panelKey(dashboardUid, panelId);
    const snapshot = summarySnapshots.get(key) ?? getBlockedSummary(dashboardUid, panelId);
    summarySnapshots.set(key, snapshot);
    return snapshot;
  });
}
