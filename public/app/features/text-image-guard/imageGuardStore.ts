import { useSyncExternalStore } from 'react';

/** A piece of a blocked image URL, flagged when it was interpolated from query data or variables. */
export interface UrlSegment {
  text: string;
  fromData: boolean;
}

export interface BlockedImage {
  url: string;
  host: string;
  segments: UrlSegment[];
  containsQueryData: boolean;
}

export type AllowScope = 'session' | 'always';

export interface PanelReport {
  panelTitle: string;
  images: BlockedImage[];
}

interface ImageGuardState {
  reports: ReadonlyMap<string, PanelReport>;
  allowedHosts: ReadonlySet<string>;
}

// Prototype: both scopes live in sessionStorage. 'always' is kept under its own key so it can
// move to persistent user storage without touching callers.
const STORAGE_KEYS: Record<AllowScope, string> = {
  session: 'grafana.textImageGuard.allowedHosts',
  always: 'grafana.textImageGuard.alwaysAllowedHosts',
};

function readHosts(scope: AllowScope): string[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEYS[scope]);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    return [];
  }
}

function writeHosts(scope: AllowScope, hosts: string[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEYS[scope], JSON.stringify(hosts));
  } catch {
    // Storage can be unavailable (private mode); the in-memory set still applies for this page.
  }
}

let state: ImageGuardState = {
  reports: new Map(),
  allowedHosts: new Set([...readHosts('session'), ...readHosts('always')]),
};

const listeners = new Set<() => void>();

function setState(next: ImageGuardState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useImageGuardState(): ImageGuardState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useAllowedHosts(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => state.allowedHosts);
}

function sameReport(a: PanelReport | undefined, b: PanelReport) {
  return (
    a !== undefined &&
    a.panelTitle === b.panelTitle &&
    a.images.length === b.images.length &&
    a.images.every((img, i) => img.url === b.images[i].url)
  );
}

/** Replaces everything a panel previously reported, so re-renders never double count. */
export function reportBlockedImages(panelKey: string, report: PanelReport) {
  const current = state.reports.get(panelKey);
  if (report.images.length === 0 && current === undefined) {
    return;
  }
  if (sameReport(current, report)) {
    return;
  }

  const reports = new Map(state.reports);
  if (report.images.length === 0) {
    reports.delete(panelKey);
  } else {
    reports.set(panelKey, report);
  }
  setState({ ...state, reports });
}

export function clearBlockedImages(panelKey: string) {
  reportBlockedImages(panelKey, { panelTitle: '', images: [] });
}

export function allowHosts(hosts: string[], scope: AllowScope) {
  writeHosts(scope, Array.from(new Set([...readHosts(scope), ...hosts])));
  setState({ ...state, allowedHosts: new Set([...state.allowedHosts, ...hosts]) });
}

/** Prototype helper: forgets every approval so the flow can be tested again. */
export function resetAllowedHosts() {
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Nothing to clear when storage is unavailable.
    }
  }
  setState({ ...state, allowedHosts: new Set() });
}

export interface BlockedResource {
  host: string;
  /** Distinct URLs, in first-seen order. */
  urls: BlockedImage[];
  imageCount: number;
  /** Titles of the panels loading from this host, in first-seen order. */
  panelTitles: string[];
}

/** Groups every panel's blocked images by host. */
export function groupByHost(reports: ReadonlyMap<string, PanelReport>): BlockedResource[] {
  const byHost = new Map<string, BlockedResource>();

  for (const { panelTitle, images } of reports.values()) {
    for (const image of images) {
      let resource = byHost.get(image.host);
      if (!resource) {
        resource = { host: image.host, urls: [], imageCount: 0, panelTitles: [] };
        byHost.set(image.host, resource);
      }
      resource.imageCount++;
      if (!resource.panelTitles.includes(panelTitle)) {
        resource.panelTitles.push(panelTitle);
      }
      if (!resource.urls.some((u) => u.url === image.url)) {
        resource.urls.push(image);
      }
    }
  }

  return Array.from(byHost.values());
}
