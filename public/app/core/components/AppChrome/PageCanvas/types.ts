import { type IconName, isIconName } from '@grafana/data';

/** What a tab shows: the plugin's content in the canvas pane, or the live Grafana page at the tab's `href`. */
export type PageCanvasTabShows = 'pane' | 'page';

/** A spinner (`working`) or a dot (`updated`) after a tab's label, with the label screen readers announce. */
export interface PageCanvasTabIndicator {
  kind: 'working' | 'updated';
  label: string;
}

/** One tab of a page canvas. */
export interface PageCanvasTab {
  id: string;
  label: string;
  icon?: IconName;
  /** A count badge, for example the number of sources. */
  count?: number;
  indicator?: PageCanvasTabIndicator;
  closable: boolean;
  reorderable: boolean;
  shows: PageCanvasTabShows;
  /**
   * The tab's Grafana page, as a path in this Grafana. Required when the tab shows the page; on a pane tab it is
   * where "Open as a Grafana page" goes.
   */
  href?: string;
}

/**
 * The tabs a plugin shows above the page, and the callbacks core calls when the user acts on them. The plugin owns
 * which tabs exist and which is active; core renders them and reports what the user asked for.
 */
export interface PageCanvasModel {
  /** Accessible name of the tab strip, for example "Canvas". */
  label: string;
  /** Open tabs, in strip order. */
  tabs: PageCanvasTab[];
  activeTabId: string;
  /** Closed tabs whose content still exists, most recently closed first. */
  closedTabs: PageCanvasTab[];
  /** Selects a tab. Called with a closed tab's id, it reopens and selects it. */
  onSelect(tabId: string): void;
  /** Closes tabs; the plugin picks the next active tab. */
  onClose(tabIds: string[]): void;
  /** Reopens closed tabs without selecting one. */
  onReopen(tabIds: string[]): void;
  /** The open tabs' new order. */
  onReorder(tabIds: string[]): void;
  /** Core has navigated to the tab's page; the plugin removes the canvas and leaves the user there. */
  onOpenAsPage?(tabId: string): void;
  onCloseCanvas(): void;
}

/** Props core passes to the `grafana/page-canvas/v0-alpha` component. */
export interface PageCanvasProps {
  /** Shows the canvas for `model`, or removes it with `null`. Call it again whenever the model changes. */
  setCanvas(model: PageCanvasModel | null): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/** A path in this Grafana: a plugin's data must not send the router to another origin or a script URL. */
export function isAppPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\s]/.test(value);
}

function parseIndicator(value: unknown): PageCanvasTabIndicator | undefined {
  if (!isRecord(value) || typeof value.label !== 'string') {
    return undefined;
  }
  if (value.kind === 'working' || value.kind === 'updated') {
    return { kind: value.kind, label: value.label };
  }
  return undefined;
}

function parseTab(value: unknown): PageCanvasTab | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '' || typeof value.label !== 'string') {
    return undefined;
  }
  if (value.shows !== 'pane' && value.shows !== 'page') {
    return undefined;
  }
  const href = isAppPath(value.href) ? value.href : undefined;
  if (value.shows === 'page' && href === undefined) {
    return undefined;
  }
  const count =
    typeof value.count === 'number' && Number.isFinite(value.count) && value.count >= 0 ? value.count : undefined;
  return {
    id: value.id,
    label: value.label,
    icon: isIconName(value.icon) ? value.icon : undefined,
    count,
    indicator: parseIndicator(value.indicator),
    closable: value.closable === true,
    reorderable: value.reorderable === true,
    shows: value.shows,
    href,
  };
}

function parseTabs(value: unknown, seen: Set<string>): PageCanvasTab[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const tab = parseTab(entry);
    if (!tab || seen.has(tab.id)) {
      return [];
    }
    seen.add(tab.id);
    return [tab];
  });
}

/**
 * The model a plugin passed to `setCanvas`, checked field by field, or `null` when it is not one. Core and plugins
 * ship separately, so a tab core can't show is dropped rather than trusted.
 */
export function parsePageCanvasModel(value: unknown): PageCanvasModel | null {
  if (!isRecord(value) || typeof value.label !== 'string') {
    return null;
  }
  const { onSelect, onClose, onReopen, onReorder, onOpenAsPage, onCloseCanvas } = value;
  if (!isFunction(onSelect) || !isFunction(onClose) || !isFunction(onReopen) || !isFunction(onReorder)) {
    return null;
  }
  if (!isFunction(onCloseCanvas)) {
    return null;
  }
  const seen = new Set<string>();
  const tabs = parseTabs(value.tabs, seen);
  const closedTabs = parseTabs(value.closedTabs, seen);
  const activeTabId =
    typeof value.activeTabId === 'string' && tabs.some((tab) => tab.id === value.activeTabId)
      ? value.activeTabId
      : (tabs[0]?.id ?? '');
  return {
    label: value.label,
    tabs,
    activeTabId,
    closedTabs,
    onSelect: (tabId) => onSelect.call(value, tabId),
    onClose: (tabIds) => onClose.call(value, tabIds),
    onReopen: (tabIds) => onReopen.call(value, tabIds),
    onReorder: (tabIds) => onReorder.call(value, tabIds),
    onOpenAsPage: isFunction(onOpenAsPage) ? (tabId) => onOpenAsPage.call(value, tabId) : undefined,
    onCloseCanvas: () => onCloseCanvas.call(value),
  };
}
