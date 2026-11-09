import { isEqual } from 'lodash';

import { t } from '@grafana/i18n';
import { defaultAutoGridLayoutSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type Diff } from '../../../settings/version-history/utils';
import { humanizeKey, noEscape, rich } from '../richText';
import {
  type AUTO_GRID_SETTINGS,
  type ChangeKind,
  DASHBOARD_NODE_ID,
  type NodeMove,
  type NodeStatus,
  type PathKey,
  type RawChange,
  type ReviewCategory,
  type ReviewChange,
  type ReviewInput,
  type ReviewNode,
  type RichText,
  type StructureNode,
} from '../types';

import { describeNamedList, describeShowHideRules, type ListContext, listItemsOf } from './lists';
import { asArray, assignClaims, pathUpTo, valueAt } from './paths';
import { changed, describeValue, labels, type ValueFormat, type Worded } from './wording';

// --- Structure changes ---

/** A worded line of a structure change, with its place in the node's category. */
interface WordedRawChange {
  change: ReviewChange;
  order: number;
}

export interface RawChangeContext {
  /** The diffs the given claims cover. */
  diffsUnder(claims: PathKey[]): Diff[];
  nodes: StructureNode[];
  list: ListContext;
}

/** Order within a category, following WORDING.md §9. */
const FIELD_ORDER: Record<RawChange['field'], number> = {
  layoutType: -3,
  sectionOrder: -2,
  layoutSettings: 1000,
  title: 0,
  hideHeader: 1,
  fillScreen: 2,
  repeat: 3,
  collapse: 4,
  conditionalRendering: 5,
  variables: 6,
  annotations: 7,
  position: 0,
  size: 1,
  fitContent: 8,
};

/** Words a change found by structure/, splitting settings that are several fields into one line each. */
export function describeRawChange(raw: RawChange, ctx: RawChangeContext): WordedRawChange[] {
  const order = FIELD_ORDER[raw.field];
  const one = (worded: Worded): WordedRawChange[] => [{ change: { ...worded, claims: raw.claims }, order }];

  if (raw.text) {
    return [{ change: { kind: raw.kind, text: raw.text, claims: raw.claims }, order }];
  }

  switch (raw.field) {
    case 'title':
      return one(
        describeValue(labels.title(), raw.before, raw.after, {
          type: 'name',
          quoted: true,
        })
      );
    case 'hideHeader':
      return one(
        describeValue(t('dashboard-scene.review.field.hide-header', 'Hide row header'), raw.before, raw.after, {
          type: 'boolean',
        })
      );
    case 'fillScreen':
      return one(
        describeValue(LAYOUT_SETTING_LABELS.fillScreen(), raw.before, raw.after, {
          type: 'boolean',
        })
      );
    case 'fitContent':
      // A panel's own setting overrides its auto grid's; without one it follows the layout.
      return one(
        describeValue(LAYOUT_SETTING_LABELS.fitContent(), raw.before, raw.after, {
          type: 'boolean',
          absent: 'inherit',
        })
      );
    case 'collapse':
      return one({
        kind: 'changed',
        text: raw.after
          ? t('dashboard-scene.review.change.row-collapsed', 'Row: collapsed')
          : t('dashboard-scene.review.change.row-expanded', 'Row: expanded'),
      });
    case 'conditionalRendering': {
      const node = ctx.nodes.find((candidate) => candidate.id === raw.nodeId);
      const owner = node?.kind === 'panel' ? 'panel' : node?.sectionKind === 'tab' ? 'tab' : 'row';
      return describeShowHideRules(owner, raw.before, raw.after, raw.claims, ctx.diffsUnder(raw.claims), ctx.list).map(
        (change, index) => ({ change, order: order + index / 1000 })
      );
    }
    case 'size':
      return one(describeSize(raw.before, raw.after));
    case 'position':
      return one(describePosition(raw.before, raw.after));
    case 'sectionOrder':
      return one(describeSectionOrder(raw, ctx.nodes));
    case 'repeat':
      return raw.category === 'layout' ? describePanelRepeat(raw, order) : one(describeSectionRepeat(raw));
    case 'layoutSettings':
      return describeLayoutSettings(raw, order);
    case 'variables':
    case 'annotations':
      return describeSectionList(raw, order, ctx);
    default:
      return one(describeValue(humanizeKey(raw.field), raw.before, raw.after, { type: 'auto' }));
  }
}

function repeatLabel(): string {
  return t('dashboard-scene.review.field.repeat', 'Repeat by variable');
}

function describeSize(before: unknown, after: unknown): Worded {
  const show = (size: unknown) =>
    t('dashboard-scene.review.value.size', '{{width}} × {{height}}', {
      width: valueAt(size, ['width']),
      height: valueAt(size, ['height']),
      interpolation: noEscape,
    });
  const dw = Number(valueAt(after, ['width'])) - Number(valueAt(before, ['width']));
  const dh = Number(valueAt(after, ['height'])) - Number(valueAt(before, ['height']));
  const changes: string[] = [];
  if (dw) {
    changes.push(
      dw > 0
        ? t('dashboard-scene.review.value.size-wider', 'wider')
        : t('dashboard-scene.review.value.size-narrower', 'narrower')
    );
  }
  if (dh) {
    changes.push(
      dh > 0
        ? t('dashboard-scene.review.value.size-taller', 'taller')
        : t('dashboard-scene.review.value.size-shorter', 'shorter')
    );
  }
  if (!changes.length) {
    return {
      ...changed(t('dashboard-scene.review.field.size', 'Size')),
      details: { before: () => show(before), after: () => show(after) },
    };
  }
  return {
    kind: 'changed',
    text: t('dashboard-scene.review.change.size', 'Size: {{changes, list}}', { changes, interpolation: noEscape }),
    details: { before: () => show(before), after: () => show(after) },
  };
}

function describePosition(before: unknown, after: unknown): Worded {
  if (typeof before === 'number' && typeof after === 'number') {
    return {
      kind: 'changed',
      text:
        after < before
          ? t('dashboard-scene.review.change.position-earlier', 'Position: moved earlier')
          : t('dashboard-scene.review.change.position-later', 'Position: moved later'),
    };
  }
  const dx = Number(valueAt(after, ['x'])) - Number(valueAt(before, ['x']));
  const dy = Number(valueAt(after, ['y'])) - Number(valueAt(before, ['y']));
  const vertical = dy > 0 ? 'down' : dy < 0 ? 'up' : '';
  const horizontal = dx > 0 ? 'right' : dx < 0 ? 'left' : '';
  return { kind: 'changed', text: positionText(vertical, horizontal) };
}

function positionText(vertical: string, horizontal: string): string {
  switch (`${vertical}-${horizontal}`) {
    case 'down-':
      return t('dashboard-scene.review.change.position-down', 'Position: moved down');
    case 'up-':
      return t('dashboard-scene.review.change.position-up', 'Position: moved up');
    case '-right':
      return t('dashboard-scene.review.change.position-right', 'Position: moved right');
    case '-left':
      return t('dashboard-scene.review.change.position-left', 'Position: moved left');
    case 'down-right':
      return t('dashboard-scene.review.change.position-down-right', 'Position: moved down and right');
    case 'down-left':
      return t('dashboard-scene.review.change.position-down-left', 'Position: moved down and left');
    case 'up-right':
      return t('dashboard-scene.review.change.position-up-right', 'Position: moved up and right');
    case 'up-left':
      return t('dashboard-scene.review.change.position-up-left', 'Position: moved up and left');
    default:
      return t('dashboard-scene.review.change.position-changed', 'Position: changed');
  }
}

function describeSectionOrder(raw: RawChange, nodes: StructureNode[]): Worded {
  const children = nodes.filter(
    (node) => node.kind === 'section' && (node.parentId ?? DASHBOARD_NODE_ID) === raw.nodeId && node.id !== raw.nodeId
  );
  const rootChildren = nodes.filter((node) => node.kind === 'section' && node.parentId === undefined);
  const kind = (children[0] ?? (raw.nodeId === nodes[0]?.id ? rootChildren[0] : undefined))?.sectionKind;
  const label =
    kind === 'tab'
      ? t('dashboard-scene.review.field.tab-order', 'Tab order')
      : t('dashboard-scene.review.field.row-order', 'Row order');
  return {
    ...changed(label),
    details: {
      before: () => asArray(raw.before).map(String).join('\n'),
      after: () => asArray(raw.after).map(String).join('\n'),
    },
  };
}

function describeSectionRepeat(raw: RawChange): Worded {
  return describeValue(repeatLabel(), repeatValue(raw.before), repeatValue(raw.after), { type: 'name' });
}

function repeatValue(repeat: unknown): unknown {
  return typeof repeat === 'object' && repeat !== null ? valueAt(repeat, ['value']) : repeat;
}

const REPEAT_FIELDS: Array<{ key: string; label: () => string; format: ValueFormat }> = [
  { key: 'value', label: repeatLabel, format: { type: 'name' } },
  {
    key: 'direction',
    label: () => t('dashboard-scene.review.field.repeat-direction', 'Repeat direction'),
    format: { type: 'name', display: displayDirection },
  },
  {
    key: 'maxPerRow',
    label: () => t('dashboard-scene.review.field.max-per-row', 'Max per row'),
    format: { type: 'auto' },
  },
];

function displayDirection(value: unknown): string | undefined {
  switch (value) {
    case 'h':
      return t('dashboard-scene.review.value.direction-horizontal', 'horizontal');
    case 'v':
      return t('dashboard-scene.review.value.direction-vertical', 'vertical');
    default:
      return undefined;
  }
}

function describePanelRepeat(raw: RawChange, order: number): WordedRawChange[] {
  const fields = REPEAT_FIELDS.filter(({ key }) => !isEqual(valueAt(raw.before, [key]), valueAt(raw.after, [key])));
  if (!fields.length) {
    return [
      {
        change: { ...describeValue(repeatLabel(), raw.before, raw.after, { type: 'long' }), claims: raw.claims },
        order,
      },
    ];
  }
  const lines = fields.map(({ key, label, format }, index) => {
    const claims: PathKey[] = [];
    const change: ReviewChange = {
      ...describeValue(label(), valueAt(raw.before, [key]), valueAt(raw.after, [key]), format),
      claims,
    };
    return { key, order: order + index / 10, change, claims };
  });
  assignClaims(lines, raw.claims, (segments) => segments[segments.lastIndexOf('repeat') + 1]);
  return lines.map(({ change, order }) => ({ change, order }));
}

const LAYOUT_SETTING_LABELS: Record<(typeof AUTO_GRID_SETTINGS)[number], () => string> = {
  maxColumnCount: () => t('dashboard-scene.review.field.max-columns', 'Max columns'),
  columnWidthMode: () => t('dashboard-scene.review.field.column-width', 'Column width'),
  columnWidth: () => t('dashboard-scene.review.field.custom-column-width', 'Custom column width'),
  rowHeightMode: () => t('dashboard-scene.review.field.row-height', 'Row height'),
  rowHeight: () => t('dashboard-scene.review.field.custom-row-height', 'Custom row height'),
  minHeightMode: () => t('dashboard-scene.review.field.min-height', 'Min height'),
  minHeight: () => t('dashboard-scene.review.field.custom-min-height', 'Custom min height'),
  maxHeightMode: () => t('dashboard-scene.review.field.max-height', 'Max height'),
  maxHeight: () => t('dashboard-scene.review.field.custom-max-height', 'Custom max height'),
  fillScreen: () => t('dashboard-scene.review.field.fill-screen', 'Fill screen'),
  fitContent: () => t('dashboard-scene.review.field.fit-content', 'Fit content'),
  matchRowHeights: () => t('dashboard-scene.review.field.match-row-heights', 'Match row heights'),
};

function layoutSettingDefault(key: string): unknown {
  const defaults: Record<string, unknown> = { ...defaultAutoGridLayoutSpec() };
  return key !== 'items' && Object.hasOwn(defaults, key) ? defaults[key] : undefined;
}

const NO_DEFAULT = Symbol('no default');

/**
 * The value a layout field has when nobody set it, for telling a filled-in default from a user change.
 * Fields without one (e.g. a panel's fit content override, which follows its layout) never read as defaults.
 */
export function rawFieldDefault(raw: RawChange): unknown {
  switch (raw.field) {
    case 'collapse':
    case 'hideHeader':
    case 'fillScreen':
      return false;
    case 'layoutSettings':
      return raw.subField ? (layoutSettingDefault(raw.subField) ?? NO_DEFAULT) : NO_DEFAULT;
    default:
      return NO_DEFAULT;
  }
}

function describeLayoutSettings(raw: RawChange, order: number): WordedRawChange[] {
  if (raw.subField) {
    const subField = raw.subField;
    const label = isAutoGridSetting(subField) ? LAYOUT_SETTING_LABELS[subField]() : humanizeKey(subField);
    const fallback = layoutSettingDefault(raw.subField);
    // The serializer leaves a setting out when it is at its default, so a missing boolean reads as that default.
    const format: ValueFormat =
      typeof fallback === 'boolean' ? { type: 'boolean', absent: fallback } : { type: 'auto' };
    return [
      {
        // structure/ lists layout settings in display order; the category keeps it.
        change: { ...describeValue(label, raw.before, raw.after, format), claims: raw.claims },
        order,
      },
    ];
  }
  return [
    {
      change: {
        ...describeValue(t('dashboard-scene.review.field.layout', 'Layout'), raw.before, raw.after, { type: 'long' }),
        claims: raw.claims,
      },
      order,
    },
  ];
}

function isAutoGridSetting(key: string): key is (typeof AUTO_GRID_SETTINGS)[number] {
  return Object.hasOwn(LAYOUT_SETTING_LABELS, key);
}

function describeSectionList(raw: RawChange, order: number, ctx: RawChangeContext): WordedRawChange[] {
  const covered = ctx.diffsUnder(raw.claims);
  const listPath = listPathOf(raw.claims[0] ?? '', raw.field);
  const items = listItemsOf(raw.field === 'variables' ? 'variables' : 'annotations', {
    fieldConfigLabel: (id) => id,
  });
  const changes = describeNamedList(listPath, asArray(raw.before), asArray(raw.after), covered, items, ctx.list);
  if (!changes.length) {
    return [{ change: { ...changed(humanizeKey(raw.field)), claims: raw.claims }, order }];
  }
  return changes.map((change, index) => ({ change, order: order + index / 1000 }));
}

/** The path of the section's own list: the claim up to the last `variables` / `annotations` segment. */
function listPathOf(claim: PathKey, field: string): string[] {
  const segments = claim.split('/');
  return pathUpTo(segments, field) ?? segments;
}

// --- Overview ---

export function categoryLabel(category: ReviewCategory): string {
  switch (category) {
    case 'properties':
      return t('dashboard-scene.review.category.properties', 'Properties');
    case 'layout':
      return t('dashboard-scene.review.category.layout', 'Layout');
    case 'controls':
      return t('dashboard-scene.review.category.controls', 'Controls');
    case 'repeat':
      return t('dashboard-scene.review.category.repeat', 'Repeat');
    case 'showHide':
      return t('dashboard-scene.review.category.conditional-rendering', 'Conditional rendering');
    case 'data':
      return t('dashboard-scene.review.category.data', 'Data');
    case 'visualization':
      return t('dashboard-scene.review.category.visualization', 'Visualization');
    case 'pluginOptions':
      return t('dashboard-scene.review.category.plugin-options', 'Plugin options');
    case 'fieldConfig':
      return t('dashboard-scene.review.category.field-config', 'Field config');
    case 'other':
    default:
      return t('dashboard-scene.review.category.other', 'Other');
  }
}

/** The lowercase form used in a collapsed node's summary (lowercasing isn't safe in every language). */
function categorySummaryLabel(category: ReviewCategory): string {
  switch (category) {
    case 'properties':
      return t('dashboard-scene.review.category-summary.properties', 'properties');
    case 'layout':
      return t('dashboard-scene.review.category-summary.layout', 'layout');
    case 'controls':
      return t('dashboard-scene.review.category-summary.controls', 'controls');
    case 'repeat':
      return t('dashboard-scene.review.category-summary.repeat', 'repeat');
    case 'showHide':
      return t('dashboard-scene.review.category-summary.conditional-rendering', 'conditional rendering');
    case 'data':
      return t('dashboard-scene.review.category-summary.data', 'data');
    case 'visualization':
      return t('dashboard-scene.review.category-summary.visualization', 'visualization');
    case 'pluginOptions':
      return t('dashboard-scene.review.category-summary.plugin-options', 'plugin options');
    case 'fieldConfig':
      return t('dashboard-scene.review.category-summary.field-config', 'field config');
    case 'other':
    default:
      return t('dashboard-scene.review.category-summary.other', 'other');
  }
}

/**
 * What happened to a node, read after its label (WORDING.md §3): the move, "was updated (N changes)" for its
 * change lines, or both. Added and removed nodes are marked instead, and a node with neither (a header) has none.
 */
export function nodeStatusText(
  status: NodeStatus | undefined,
  move: NodeMove | undefined,
  lines: number
): RichText | undefined {
  if (status === 'added' || status === 'removed') {
    return undefined;
  }
  const moved = status === 'moved' ? move : undefined;
  if (moved && moved.position !== undefined) {
    const position = String(moved.position);
    if (!lines) {
      return rich({ move: moved.text, position }, (p) =>
        t('dashboard-scene.review.status.moved-at-position', '{{move}}, at position {{position}}', {
          ...p,
          interpolation: noEscape,
        })
      );
    }
    return rich({ move: moved.text, position }, (p) =>
      t('dashboard-scene.review.status.moved-at-position-and-updated', '', {
        ...p,
        count: lines,
        interpolation: noEscape,
        defaultValue_one: '{{move}}, at position {{position}}, and was updated ({{count}} change)',
        defaultValue_other: '{{move}}, at position {{position}}, and was updated ({{count}} changes)',
      })
    );
  }
  if (!lines) {
    return moved?.text;
  }
  if (moved) {
    return rich({ move: moved.text }, (p) =>
      t('dashboard-scene.review.status.moved-and-updated', '', {
        ...p,
        count: lines,
        interpolation: noEscape,
        defaultValue_one: '{{move}} and was updated ({{count}} change)',
        defaultValue_other: '{{move}} and was updated ({{count}} changes)',
      })
    );
  }
  return [
    t('dashboard-scene.review.status.updated', '', {
      count: lines,
      defaultValue_one: 'was updated ({{count}} change)',
      defaultValue_other: 'was updated ({{count}} changes)',
    }),
  ];
}

type ElementKindWord = 'panel' | 'row' | 'tab';

/**
 * "(3 panels moved to it, 1 panel added)": what an added section holds, read after its header. Moved-in elements
 * are the ones a layout change put there; added ones are its new direct children. Kinds are named when the
 * elements are all of one kind, "elements" otherwise. Undefined when it holds neither.
 */
export function sectionContentsText(movedIn: RichText[], added: ElementKindWord[]): RichText | undefined {
  const movedKinds = movedIn.map((content) => content.find((part) => typeof part !== 'string')?.kind);
  const parts = [
    ...(movedIn.length ? [movedInPart(oneKind(movedKinds), movedIn.length)] : []),
    ...(added.length ? [addedPart(oneKind(added), added.length)] : []),
  ];
  if (!parts.length) {
    return undefined;
  }
  return [
    t('dashboard-scene.review.status.section-contents', '({{parts, list(type: unit; style: short)}})', {
      parts,
      interpolation: noEscape,
    }),
  ];
}

function oneKind(kinds: Array<string | undefined>): string | undefined {
  const unique = new Set(kinds);
  return unique.size === 1 ? [...unique][0] : undefined;
}

function movedInPart(kind: string | undefined, count: number): string {
  switch (kind) {
    case 'panel':
      return t('dashboard-scene.review.status.moved-in-panels', '', {
        count,
        defaultValue_one: '{{count}} panel moved to it',
        defaultValue_other: '{{count}} panels moved to it',
      });
    case 'row':
      return t('dashboard-scene.review.status.moved-in-rows', '', {
        count,
        defaultValue_one: '{{count}} row moved to it',
        defaultValue_other: '{{count}} rows moved to it',
      });
    case 'tab':
      return t('dashboard-scene.review.status.moved-in-tabs', '', {
        count,
        defaultValue_one: '{{count}} tab moved to it',
        defaultValue_other: '{{count}} tabs moved to it',
      });
    default:
      return t('dashboard-scene.review.status.moved-in-elements', '', {
        count,
        defaultValue_one: '{{count}} element moved to it',
        defaultValue_other: '{{count}} elements moved to it',
      });
  }
}

function addedPart(kind: string | undefined, count: number): string {
  switch (kind) {
    case 'panel':
      return t('dashboard-scene.review.status.added-panels', '', {
        count,
        defaultValue_one: '{{count}} panel added',
        defaultValue_other: '{{count}} panels added',
      });
    case 'row':
      return t('dashboard-scene.review.status.added-rows', '', {
        count,
        defaultValue_one: '{{count}} row added',
        defaultValue_other: '{{count}} rows added',
      });
    case 'tab':
      return t('dashboard-scene.review.status.added-tabs', '', {
        count,
        defaultValue_one: '{{count}} tab added',
        defaultValue_other: '{{count}} tabs added',
      });
    default:
      return t('dashboard-scene.review.status.added-elements', '', {
        count,
        defaultValue_one: '{{count}} element added',
        defaultValue_other: '{{count}} elements added',
      });
  }
}

/** "data, field config": the node's changed categories as a unit list. */
export function nodeSummary(categories: ReviewCategory[]): string {
  if (!categories.length) {
    return '';
  }
  return t('dashboard-scene.review.node.summary', '{{categories, list(type: unit; style: short)}}', {
    categories: categories.map(categorySummaryLabel),
    interpolation: noEscape,
  });
}

/** The top-level elements a save changes something in, by kind: a change inside a tab is a change to the tab. */
export interface TopLevelCounts {
  rows: number;
  tabs: number;
  panels: number;
}

export function overviewLine(dashboard: boolean, { rows, tabs, panels }: TopLevelCounts, isNew = false): string {
  const parts: string[] = [];
  if (dashboard) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.dashboard-first', 'The dashboard')
        : t('dashboard-scene.review.overview.dashboard', 'the dashboard')
    );
  }
  if (rows) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.rows-first', '', {
            count: rows,
            defaultValue_one: '{{count}} row',
            defaultValue_other: '{{count}} rows',
          })
        : t('dashboard-scene.review.overview.rows', '', {
            count: rows,
            defaultValue_one: '{{count}} row',
            defaultValue_other: '{{count}} rows',
          })
    );
  }
  if (tabs) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.tabs-first', '', {
            count: tabs,
            defaultValue_one: '{{count}} tab',
            defaultValue_other: '{{count}} tabs',
          })
        : t('dashboard-scene.review.overview.tabs', '', {
            count: tabs,
            defaultValue_one: '{{count}} tab',
            defaultValue_other: '{{count}} tabs',
          })
    );
  }
  if (panels) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.panels-first', '', {
            count: panels,
            defaultValue_one: '{{count}} panel',
            defaultValue_other: '{{count}} panels',
          })
        : t('dashboard-scene.review.overview.panels', '', {
            count: panels,
            defaultValue_one: '{{count}} panel',
            defaultValue_other: '{{count}} panels',
          })
    );
  }
  if (!parts.length) {
    return '';
  }
  // A new dashboard's intro already says "This creates a new dashboard with:", so its line is the bare list.
  return isNew
    ? t('dashboard-scene.review.overview.new-line', '{{parts, list}}', { parts, interpolation: noEscape })
    : t('dashboard-scene.review.overview.line', 'Changes to {{parts, list}}', { parts, interpolation: noEscape });
}

/** Every change line in the tree, every node with a status (once), and every Metadata line. */
/** Changes a line stands for: an element's grouped field changes count one each. */
export function changeCount(change: ReviewChange): number {
  return change.changes?.length ?? 1;
}

export function countChanges(tree: ReviewNode[], metadata: ReviewChange[]): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = { added: 0, changed: 0, removed: 0, moved: 0 };
  const visit = (node: ReviewNode) => {
    if (node.status) {
      counts[node.status]++;
    }
    node.categories.forEach((group) =>
      group.changes.forEach((change) => (change.changes ?? [change]).forEach((leaf) => counts[leaf.kind]++))
    );
    if (node.kind === 'section') {
      node.children.forEach(visit);
    }
  };
  tree.forEach(visit);
  metadata.forEach((change) => counts[change.kind]++);
  return counts;
}

export function describeMetadata(metadata: ReviewInput['metadata']): ReviewChange[] {
  const changes: ReviewChange[] = [];
  if (metadata?.folder) {
    const dashboards = t('dashboard-scene.review.metadata.root-folder', 'Dashboards');
    changes.push({
      kind: 'changed',
      text: t('dashboard-scene.review.metadata.folder', 'Folder: {{before}} → {{after}}', {
        before: metadata.folder.before || dashboards,
        after: metadata.folder.after || dashboards,
        interpolation: noEscape,
      }),
      claims: [],
    });
  }
  if (metadata?.predefinedVariables) {
    const none = t('dashboard-scene.review.metadata.no-predefined-variables', 'None');
    changes.push({
      kind: 'changed',
      text: t('dashboard-scene.review.metadata.predefined-variables', 'Predefined variables: {{before}} → {{after}}', {
        before: metadata.predefinedVariables.before || none,
        after: metadata.predefinedVariables.after || none,
        interpolation: noEscape,
      }),
      claims: [],
    });
  }
  return changes;
}
