import { type PanelPlugin } from '@grafana/data';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

/*
 * Contract for the Review tab of the save drawer: a human-friendly summary of what a save changes.
 *
 * Pipeline: summarizeDashboardChanges(ReviewInput)
 *   1. jsonDiff(baseline, payload), flattened                      (describe/)
 *   2. buildStructure(baseline, payload) → Structure               (structure/)
 *      every dashboard, section and panel node from both sides, plus the semantic layout changes
 *   3. attribute the remaining diffs, classify system defaults,    (describe/)
 *      word every change, prune unchanged nodes → ReviewSummary
 *
 * Every user-facing string in a ReviewSummary is already translated; the UI only lays it out.
 */

export type ReviewMode = 'save' | 'new' | 'saveAsCopy';

export interface ReviewInput {
  mode: ReviewMode;
  /** The serializer's initial save model. Null for a brand-new dashboard: everything is an addition. */
  baseline: DashboardV2Spec | null;
  /** The spec that will actually be sent (save options applied, or the Save As model). */
  payload: DashboardV2Spec;
  /** 'pendingChanges' when the baseline is a recorded pending change rather than the saved dashboard. */
  baselineKind: 'saved' | 'pendingChanges';
  /** Save As copy: title of the dashboard being copied. */
  sourceTitle?: string;
  /** Changes saved outside the spec. Each is present only when it changed. */
  metadata?: {
    folder?: { before?: string; after?: string };
    predefinedVariables?: { before?: string; after?: string };
  };
  /** Loaded panel plugins, for option labels and default classification. Never blocks: undefined means fall back. */
  getPlugin?: (pluginId: string) => PanelPlugin | undefined;
}

export type ChangeKind = 'added' | 'changed' | 'removed' | 'moved';

export type DashboardCategory = 'properties' | 'layout' | 'controls' | 'other';
export type SectionCategory = 'properties' | 'layout' | 'repeat' | 'showHide' | 'controls' | 'other';
export type PanelCategory =
  | 'properties'
  | 'layout'
  | 'showHide'
  | 'data'
  | 'visualization'
  | 'pluginOptions'
  | 'fieldConfig'
  | 'other';
export type ReviewCategory = DashboardCategory | SectionCategory | PanelCategory;

/** Id of the dashboard's own node, the root of every structure. */
export const DASHBOARD_NODE_ID = 'dashboard';

/** Auto grid settings in the order the layout options list them. */
export const AUTO_GRID_SETTINGS = [
  'maxColumnCount',
  'columnWidthMode',
  'columnWidth',
  'rowHeightMode',
  'rowHeight',
  'minHeightMode',
  'minHeight',
  'maxHeightMode',
  'maxHeight',
  'fillScreen',
  'fitContent',
  'matchRowHeights',
] as const;

export function settingRank(key: string): number {
  const order: readonly string[] = AUTO_GRID_SETTINGS;
  const rank = order.indexOf(key);
  return rank === -1 ? order.length : rank;
}

/** Display order of categories per node kind, as in the plan's structure table. */
export const CATEGORY_ORDER = {
  dashboard: ['properties', 'layout', 'controls', 'other'],
  section: ['properties', 'layout', 'repeat', 'showHide', 'controls', 'other'],
  panel: ['properties', 'layout', 'showHide', 'data', 'visualization', 'pluginOptions', 'fieldConfig', 'other'],
} as const satisfies Record<ReviewNodeKind, readonly ReviewCategory[]>;

/**
 * A diff path key: jsonDiff's path segments joined with '/', exactly as jsonDiff returns them
 * (JSON-pointer escapes such as `~1` kept, so keys stay unambiguous). Unescape only for display.
 * A claim covers a diff path when the path equals it or starts with it followed by '/'.
 */
export type PathKey = string;

export function pathKey(path: readonly string[]): PathKey {
  return path.join('/');
}

export function claimCovers(claim: PathKey, path: PathKey): boolean {
  return path === claim || path.startsWith(claim + '/');
}

/**
 * Kinds of dashboard element a change line can be about. The UI shows an icon for those the content outline
 * and the panel editor have one for; tags, overrides and show/hide rules get the +/− marker only.
 * Nodes get their icon from their kind (dashboard, panel, row or tab).
 */
export type ReviewElementKind =
  | 'dashboard'
  | 'panel'
  | 'row'
  | 'tab'
  | 'variable'
  | 'adHocFilter'
  | 'annotation'
  | 'link'
  | 'query'
  | 'transformation'
  | 'tag'
  | 'override'
  | 'rule';

export interface ReviewChange {
  kind: ChangeKind;
  /**
   * The whole translated line, e.g. "Unit: none → percent", "Transparent background: turned on".
   * When an element with a `subject` is added or removed, the line is just its name, e.g. `Query "B"`:
   * the UI marks it with a green + or a red −.
   */
  text: string;
  /** Set when the line is about one element (a variable, a query, …), so the UI can prefix its icon. */
  subject?: ReviewElementKind;
  /** Long or structured values, revealed by a "Show" toggle. Pretty-printed; absent side means none. */
  details?: { before?: string; after?: string };
  /** Diff paths this change accounts for. Metadata changes claim nothing (they are outside the spec). */
  claims: PathKey[];
}

export interface ReviewCategoryGroup {
  category: ReviewCategory;
  /** Translated category label, e.g. "Field config". */
  label: string;
  changes: ReviewChange[];
}

export type ReviewNodeKind = 'dashboard' | 'section' | 'panel';
export type NodeStatus = 'added' | 'removed' | 'moved';

interface ReviewNodeBase {
  id: string;
  /**
   * Translated header, element type first, then the name in double quotes. Dashboard: "Dashboard".
   * Section: its full path from the root, e.g. `Tab "Cluster" › Row "Nodes"`. Panel: how a person would
   * point at it, e.g. `Panel "CPU usage"`. The UI prefixes the node kind's icon.
   */
  label: string;
  /** Set when the node itself was added, removed or moved. Added and removed are shown as a + or − marker. */
  status?: NodeStatus;
  /**
   * Translated, read after the label: what happened to a moved or updated node, e.g.
   * `moved after Panel "Latency"`, `was updated (3 changes)`, `moved after Panel "Latency" and was updated (1 change)`.
   * Absent for added, removed and header-only nodes.
   */
  statusText?: string;
  /** Translated one-line summary shown when collapsed: changed category labels as a list, e.g. "data, field config". */
  summary: string;
  /** Non-empty groups only, in CATEGORY_ORDER. An added or removed node lists none: its header is enough. */
  categories: ReviewCategoryGroup[];
  /** Diff paths accounted for by the node's status (e.g. the whole added element and its layout item). */
  claims: PathKey[];
}

export interface DashboardReviewNode extends ReviewNodeBase {
  kind: 'dashboard';
}

export interface PanelReviewNode extends ReviewNodeBase {
  kind: 'panel';
}

export interface SectionReviewNode extends ReviewNodeBase {
  kind: 'section';
  sectionKind: 'row' | 'tab';
  /** Panels and nested sections with changes, in reading order. A section with no own changes is a header only. */
  children: Array<SectionReviewNode | PanelReviewNode>;
  /** Removed section only: translated names of the panels and sections removed with it, in baseline reading order. */
  removedContents?: string[];
}

export type ReviewNode = DashboardReviewNode | SectionReviewNode | PanelReviewNode;

export interface SystemDefaultGroup {
  /** Translated owner, e.g. "Dashboard" or a panel label. */
  label: string;
  changes: ReviewChange[];
}

export interface ReviewSummary {
  mode: ReviewMode;
  baselineKind: 'saved' | 'pendingChanges';
  sourceTitle?: string;
  overview: {
    /** Translated, e.g. "Changes to the dashboard, 2 sections, and 4 panels". Empty when the tree is empty. */
    line: string;
    /** Over the change tree and Metadata; System defaults are not counted. A node with a status counts once. */
    counts: Record<ChangeKind, number>;
  };
  /** The dashboard node first (when it has changes), then sections and root-level panels in reading order. */
  tree: ReviewNode[];
  metadata: ReviewChange[];
  systemDefaults: SystemDefaultGroup[];
  /** Diff paths deliberately left out as internal bookkeeping. Listed so completeness stays checkable. */
  bookkeeping: PathKey[];
  /** True when more than 10 panels changed: panel nodes start collapsed. */
  collapsePanelsByDefault: boolean;
}

/*
 * Internal contract between structure/ (identity, naming, ordering, layout) and describe/ (attribution, wording).
 */

/** Field keys for changes found by structure/. describe/ owns their labels and formatting. */
export type StructureFieldKey =
  // dashboard
  | 'layoutType'
  | 'sectionOrder'
  | 'layoutSettings'
  // section
  | 'title'
  | 'hideHeader'
  | 'collapse'
  | 'fillScreen'
  | 'repeat'
  | 'conditionalRendering'
  | 'variables'
  | 'annotations'
  // panel layout item
  | 'position'
  | 'size'
  | 'fitContent';

/** A change found by structure/, not yet worded (unless `text` is given). */
export interface RawChange {
  nodeId: string;
  category: ReviewCategory;
  field: StructureFieldKey;
  /** Which setting changed, for fields that group several (e.g. `layoutSettings` → 'maxColumnCount'). */
  subField?: string;
  kind: ChangeKind;
  before?: unknown;
  after?: unknown;
  claims: PathKey[];
  /** Already translated line, for changes only structure/ can word (e.g. "Layout: changed from rows to tabs"). */
  text?: string;
}

export interface StructureNode {
  id: string;
  kind: ReviewNodeKind;
  sectionKind?: 'row' | 'tab';
  /** Translated header, as in ReviewNodeBase.label. */
  label: string;
  /** Parent node id; undefined for the dashboard and for root-level sections and panels. */
  parentId?: string;
  status?: NodeStatus;
  /**
   * Moved nodes: the move text, without the node's own position, e.g.
   * `moved from Tab "Tab 2" to Tab "Tab 1", after Panel "P2"`. describe/ composes the final statusText.
   */
  moveText?: string;
  /** Moved nodes with an ambiguous name: their new 1-based position, appended by describe/ ("at position 1"). */
  movePosition?: number;
  /** Panel nodes: the element name (key in `elements`). */
  elementName?: string;
  /**
   * Panel nodes: the label where no tree shows the section (System defaults owners): the name, plus
   * `in <section path>` when the title isn't unique in the dashboard.
   */
  ownerLabel?: string;
  removedContents?: string[];
  claims: PathKey[];
}

export interface Structure {
  /** Every dashboard, section and panel node from both sides, in display order; describe/ prunes unchanged ones. */
  nodes: StructureNode[];
  /** Semantic changes inside `layout`. Together with node claims, these claim every diff path under `layout`. */
  changes: RawChange[];
  /** Panel node id by element name, for elements on either side. */
  panelNodeId(elementName: string): string | undefined;
}
