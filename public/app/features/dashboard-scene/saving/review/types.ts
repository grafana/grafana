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

/**
 * A dashboard element named inside a translated text. The UI shows its kind as an icon (with the kind word for
 * screen readers); plain text renders it as the word, e.g. `Row "DB"`.
 */
export interface NamedElement {
  kind: 'panel' | 'row' | 'tab';
  /** The quoted title or `(unnamed)`, without the kind word, e.g. `"CPU"`. */
  name: string;
  /** The header's own node: the UI skips its icon because the header's leading icon already shows it. */
  self?: boolean;
}

/** Translated text with named elements in it. Build it with `rich()` from `richText.ts`, never by concatenation. */
export type RichText = Array<string | NamedElement>;

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

/** Id of the dashboard's own node, the root of every structure. */
export const DASHBOARD_NODE_ID = 'dashboard';

/** Id of a panel's node, on either side: panels are identified by their element name. */
export function panelNodeId(elementName: string): string {
  return `panel:${elementName}`;
}

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

/** Display order of categories per node kind, as in the plan's structure table. */
export const CATEGORY_ORDER = {
  dashboard: ['properties', 'layout', 'controls', 'other'],
  section: ['properties', 'layout', 'repeat', 'showHide', 'controls', 'other'],
  panel: ['properties', 'layout', 'showHide', 'data', 'visualization', 'pluginOptions', 'fieldConfig', 'other'],
} as const satisfies Record<ReviewNodeKind, readonly string[]>;

export type ReviewCategory = (typeof CATEGORY_ORDER)[ReviewNodeKind][number];

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

/**
 * A long value, pretty-printed when its "Show" is clicked: every added panel has some, few are ever opened.
 */
export type LazyText = () => string;

/**
 * One property of an added or removed element, listed when its toggle is opened: what the element is set to,
 * not what changed. Only what's set is listed: empty values and defaults are left out.
 */
export interface ReviewProperty {
  /** Translated, e.g. "Title", "Queries (2)". */
  label: string;
  /** A literal value, shown next to the label: `"Cache hits"`, `5`, `Yes`, `Time series`. */
  value?: string;
  /** An object or array, pretty-printed JSON revealed by a "Show" button. */
  details?: LazyText;
}

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
  details?: { before?: LazyText; after?: LazyText };
  /** Added or removed element: what it is set to, revealed by its +/− toggle. */
  properties?: ReviewProperty[];
  /**
   * An element with several changed fields: one line naming it (`text` is its name, `statusText` the count,
   * "(3 changes)"), its field changes revealed by a chevron. The group claims what its changes account for.
   */
  changes?: ReviewChange[];
  statusText?: string;
  /** Said once, next to its category's label rather than on the line: e.g. how the show/hide rules combine. */
  categoryNote?: string;
  /** Diff paths this change accounts for. Metadata changes claim nothing (they are outside the spec). */
  claims: PathKey[];
}

export interface ReviewCategoryGroup {
  category: ReviewCategory;
  /** Translated category label, e.g. "Field config". */
  label: string;
  /** Translated, read after the label: what holds for every change in the group, e.g. "(Match all)". */
  note?: string;
  changes: ReviewChange[];
}

type ReviewNodeKind = 'dashboard' | 'section' | 'panel';
export type NodeStatus = 'added' | 'removed' | 'moved';

interface ReviewNodeBase {
  id: string;
  /**
   * Translated header. Dashboard: `["Dashboard"]`. Sections and panels: the node's own name (`self`, so the UI
   * shows only the leading icon), `Added`/`Removed` before it when added or removed, and `under <parent path>`
   * when the tree doesn't show its direct parent as the node's parent. In plain text:
   * `Added Row "New row" under Tab "Tab 1"`, `Removed Tab "Tab 2"`, `Panel "CPU" at position 2`.
   * The UI prefixes the node kind's icon.
   */
  label: RichText;
  /** Set when the node itself was added, removed or moved. Added and removed are shown as a + or − marker. */
  status?: NodeStatus;
  /**
   * Translated, read after the label: what happened to a moved or updated node, e.g.
   * `moved after Panel "Latency"`, `was updated (3 changes)`, `moved after Panel "Latency" and was updated (1 change)`.
   * Absent for added, removed and header-only nodes.
   */
  statusText?: RichText;
  /** Translated one-line summary shown when collapsed: changed category labels as a list, e.g. "data, field config". */
  summary: string;
  /** Non-empty groups only, in CATEGORY_ORDER. An added or removed node lists none: its header is enough. */
  categories: ReviewCategoryGroup[];
  /** Added or removed panel or section: what it is set to, revealed by its +/− toggle. */
  properties?: ReviewProperty[];
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
  removedContents?: RichText[];
  /**
   * Added section only: the panels and sections that already existed and were placed in it by a layout change
   * (no move of their own), in reading order, by translated name and node id. Not counted as changes: the layout
   * change is. An entry whose element also changed is one of `children`: it is shown in the entry's place, as its
   * own collapsible line, and nowhere else.
   */
  movedIn?: MovedInEntry[];
}

export interface MovedInEntry {
  name: RichText;
  nodeId: string;
}

export type ReviewNode = DashboardReviewNode | SectionReviewNode | PanelReviewNode;

export interface SystemDefaultGroup {
  /** Translated owner, e.g. `["Dashboard"]` or a panel's owner label (`Panel "CPU" in Tab "A"`). */
  label: RichText;
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

/** How structure/ says a node moved. */
export interface NodeMove {
  /** The move text, without the node's own position, e.g. `moved from Tab "Tab 2" to Tab "Tab 1", after Panel "P2"`. */
  text: RichText;
  /** Set when the node's name is ambiguous: its new 1-based position, appended by describe/ ("at position 1"). */
  position?: number;
}

export interface StructureNode {
  id: string;
  kind: ReviewNodeKind;
  sectionKind?: 'row' | 'tab';
  /**
   * Sections and panels: the node's own name, e.g. `Row "API"`, plus ` at position N` when ambiguous (except a
   * moved node, whose move text carries its position). Absent for the dashboard. describe/ composes the header.
   */
  name?: RichText;
  /**
   * Nodes inside a section: the full path of that section, e.g. `Tab "Cluster" › Row "Nodes"`. describe/ adds
   * `under <parentPath>` to the header when the tree doesn't show that section as the node's parent.
   */
  parentPath?: RichText;
  /** Parent node id; undefined for the dashboard and for root-level sections and panels. */
  parentId?: string;
  status?: NodeStatus;
  /** Moved nodes: how they moved. describe/ composes the final statusText. */
  move?: NodeMove;
  /** Panel nodes: the element name (key in `elements`). */
  elementName?: string;
  /**
   * Spec path of the row or tab, or of the panel's layout item, on the node's own side (the baseline for a
   * removed node, the payload otherwise). describe/ reads an added or removed node's properties from it.
   */
  itemPath?: PathKey;
  /**
   * Panel nodes: the label where no tree shows the section (System defaults owners): the name, plus
   * `in <section path>` when the title isn't unique in the dashboard.
   */
  ownerLabel?: RichText;
  removedContents?: RichText[];
  movedIn?: MovedInEntry[];
  /** A node moved out of another section: that section's node id (it lost the node, so it changed too). */
  movedFromId?: string;
  claims: PathKey[];
}

export interface Structure {
  /** Every dashboard, section and panel node from both sides, in display order; describe/ prunes unchanged ones. */
  nodes: StructureNode[];
  /**
   * Semantic changes inside `layout`, in node order and, within a node, in display order (e.g. layout settings
   * as the layout options list them). Together with node claims, these claim every diff path under `layout`.
   */
  changes: RawChange[];
}
