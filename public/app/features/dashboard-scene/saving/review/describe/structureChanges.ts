import { t } from '@grafana/i18n';
import { defaultAutoGridLayoutSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type Diff } from '../../../settings/version-history/utils';
import {
  type AUTO_GRID_SETTINGS,
  DASHBOARD_NODE_ID,
  type PathKey,
  type RawChange,
  type ReviewChange,
  settingRank,
  type StructureNode,
} from '../types';

import { changed, describeValue, type ValueFormat, type Worded } from './formatters';
import { humanizeKey } from './labels';
import { listItemsOf } from './listKinds';
import { describeNamedList, type ListContext } from './namedLists';
import { asArray, valueAt } from './paths';
import { labels } from './rules';
import { describeShowHideRules } from './showHideRules';

const noEscape = { escapeValue: false };

/** A worded line of a structure change, with its place in the node's category. */
export interface WordedRawChange {
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
      details: { before: show(before), after: show(after) },
    };
  }
  return {
    kind: 'changed',
    text: t('dashboard-scene.review.change.size', 'Size: {{changes, list}}', { changes, interpolation: noEscape }),
    details: { before: show(before), after: show(after) },
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
    details: { before: asArray(raw.before).map(String).join('\n'), after: asArray(raw.after).map(String).join('\n') },
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
  const fields = REPEAT_FIELDS.filter(
    ({ key }) => JSON.stringify(valueAt(raw.before, [key])) !== JSON.stringify(valueAt(raw.after, [key]))
  );
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
    return { key, order: order + index / 10, change };
  });
  splitClaims(raw.claims, lines, 'repeat');
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
        change: { ...describeValue(label, raw.before, raw.after, format), claims: raw.claims },
        order: order + settingRank(subField) / 100,
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

/** Gives each claim to the line whose key comes right after `below` in it; the rest go to the first line. */
function splitClaims(claims: PathKey[], lines: Array<{ key: string; change: ReviewChange }>, below: string) {
  for (const claim of claims) {
    const segments = claim.split('/');
    const next = segments[segments.lastIndexOf(below) + 1];
    const line = lines.find(({ key }) => next === key) ?? lines[0];
    line.change.claims.push(claim);
  }
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
  const index = segments.lastIndexOf(field);
  return index === -1 ? segments : segments.slice(0, index + 1);
}
