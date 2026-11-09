import { isEqual } from 'lodash';

import { type PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type Diff } from '../../settings/version-history/utils';

import {
  attribute,
  type AttributionContext,
  type DescribeContext,
  describeDefaultDiff,
  describeField,
  describeNewPluginDefaults,
  fieldConfigFormat,
  type FieldTarget,
  typeChanged,
} from './describe/fields';
import { type ListContext, listItemsOf, ruleSetText } from './describe/lists';
import { asArray, emptyBaselineFor, flatDiff, isUnset, safely, unescapeSegment, valueAt } from './describe/paths';
import { type IsDefault, panelProperties, sectionProperties } from './describe/properties';
import {
  categoryLabel,
  changeCount,
  countChanges,
  describeMetadata,
  describeRawChange,
  nodeStatusText,
  nodeSummary,
  overviewLine,
  rawFieldDefault,
  sectionContentsText,
  type TopLevelCounts,
} from './describe/structureText';
import { isDefaultValue, isSystemDefault, type DefaultsContext } from './describe/systemDefaults';
import { getPanelLabels, humanizePath, type PanelLabels } from './describe/wording';
import { asSelf, noEscape, rich } from './richText';
import { buildStructure } from './structure/buildStructure';
import {
  CATEGORY_ORDER,
  claimCovers,
  DASHBOARD_NODE_ID,
  panelNodeId,
  type PathKey,
  pathKey,
  type RawChange,
  type ReviewCategory,
  type ReviewCategoryGroup,
  type ReviewChange,
  type ReviewInput,
  type ReviewNode,
  type ReviewProperty,
  type ReviewSummary,
  type RichText,
  type SectionReviewNode,
  type Structure,
  type StructureNode,
  type SystemDefaultGroup,
} from './types';

/** Above this many changed panels, panel nodes start collapsed. */
const COLLAPSE_PANELS_ABOVE = 10;

interface NodeEntry {
  category: ReviewCategory;
  order: number;
  /** Ties within an order go by path, so the output doesn't depend on the order diffs come in. */
  key: string;
  sequence: number;
  change: ReviewChange;
}

/** The diffs buildStructure is responsible for: everything under `layout`, plus whole-element adds and removes. */
export function isStructureDiff(diff: Diff): boolean {
  return diff.path[0] === 'layout' || (diff.path[0] === 'elements' && diff.path.length === 2);
}

/** Builds the Review tab's summary of what a save changes. Pure and synchronous. */
export function summarizeDashboardChanges(input: ReviewInput): ReviewSummary {
  const payload = input.payload;
  const baseline = input.baseline ?? emptyBaselineFor(payload);
  const diffs = flatDiff(baseline, payload);

  const structure = buildStructure(baseline, payload, diffs.filter(isStructureDiff));

  const getPlugin = (id: string): PanelPlugin | undefined => safely(() => input.getPlugin?.(id));
  const defaultsCtx: DefaultsContext = {
    baseline,
    payload,
    getPlugin,
    pluginChanged: (element) => typeChanged(element, { baseline, payload }),
  };
  // Read from the element's own side: a removed element's defaults are judged against the saved dashboard.
  const isDefaultOn = (side: DashboardV2Spec): IsDefault => {
    const ctx = side === payload ? defaultsCtx : { ...defaultsCtx, payload: side };
    return (path, value) => isDefaultValue(path, 'add', value, () => false, ctx);
  };
  const listCtx: ListContext = {
    isDefault: (path, value, baselineHas) => isDefaultValue(path, 'add', value, baselineHas, defaultsCtx),
    isDefaultOn: (side) => isDefaultOn(side === 'payload' ? payload : baseline),
  };
  const labelsByElement = new Map<string, PanelLabels>();
  const attributionCtx: AttributionContext = {
    baseline,
    payload,
    panelLabels: (element) => {
      let labels = labelsByElement.get(element);
      if (!labels) {
        labels = panelLabelsOf(element, baseline, payload, getPlugin);
        labelsByElement.set(element, labels);
      }
      return labels;
    },
    getPlugin,
  };
  const describeCtx: DescribeContext = {
    baseline,
    payload,
    list: listCtx,
    listKind: (target) => {
      const fieldConfigOption = (id: string) => {
        const labels = target.owner.kind === 'panel' ? attributionCtx.panelLabels(target.owner.element) : undefined;
        const option = labels?.fieldConfig(id.split('.'));
        return option && option.path.join('.') === id ? option : undefined;
      };
      return {
        fieldConfigLabel: (id) =>
          fieldConfigOption(id)?.label ??
          humanizePath((id.startsWith('custom.') ? id.slice('custom.'.length) : id).split('.')),
        fieldConfigFormat: (id) => {
          const option = fieldConfigOption(id);
          return fieldConfigFormat(id.split('.'), option?.display, option?.textInput);
        },
      };
    },
  };

  // Attribute every diff outside the layout to a field, setting aside bookkeeping and system defaults.
  const bookkeeping: PathKey[] = [];
  const groups = new Map<string, { target: FieldTarget; diffs: Diff[]; defaults: Diff[] }>();
  for (const diff of diffs) {
    if (isStructureDiff(diff)) {
      continue;
    }
    if (isBookkeeping(diff, baseline, payload)) {
      bookkeeping.push(pathKey(diff.path));
      continue;
    }
    // '' ↔ absent (or an empty list or object): both mean "not set", so nothing a person would call a change.
    // compare adds only what the baseline lacks and removes only what the payload lacks.
    const unsetOn = (side: DashboardV2Spec, absentFor: Diff['op']) =>
      diff.op === absentFor || isUnset(valueAt(side, diff.path));
    if (unsetOn(payload, 'remove') && unsetOn(baseline, 'add')) {
      bookkeeping.push(pathKey(diff.path));
      continue;
    }
    const target = attribute(diff.path, attributionCtx);
    const isDefault = mayBeDefault(target, diff, baseline, payload, describeCtx) && isSystemDefault(diff, defaultsCtx);
    const groupKey = `${ownerKey(target)}|${target.key}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = { target, diffs: [], defaults: [] };
      groups.set(groupKey, group);
    }
    (isDefault ? group.defaults : group.diffs).push(diff);
  }

  const nodeIdOf = (target: FieldTarget) =>
    target.owner.kind === 'panel' ? panelNodeId(unescapeSegment(target.owner.element)) : DASHBOARD_NODE_ID;

  const entriesByNode = new Map<string, NodeEntry[]>();
  const defaultsByNode = new Map<string, NodeEntry[]>();
  let sequence = 0;
  const push = (map: Map<string, NodeEntry[]>, nodeId: string, entry: Omit<NodeEntry, 'sequence'>) => {
    // Everything in a new dashboard is new, whatever its line says ("Title: set to Checkout").
    const change =
      input.mode === 'new' && map === entriesByNode ? { ...entry.change, kind: 'added' as const } : entry.change;
    const list = map.get(nodeId) ?? [];
    list.push({ ...entry, change, sequence: sequence++ });
    map.set(nodeId, list);
  };

  // A new visualization's own defaults read as one line per category: "Plugin options: set to the Gauge defaults".
  const newPluginDefaults = new Map<
    string,
    { nodeId: string; category: ReviewCategory; claims: PathKey[]; name: string }
  >();
  for (const { target, diffs: fieldDiffs, defaults } of groups.values()) {
    const nodeId = nodeIdOf(target);
    if (fieldDiffs.length) {
      for (const change of describeField(target, fieldDiffs, describeCtx)) {
        push(entriesByNode, nodeId, { category: target.category, order: target.order, key: target.key, change });
      }
    }
    if (target.newPluginDefaults) {
      const key = `${nodeId}|${target.category}`;
      const aggregate = newPluginDefaults.get(key) ?? {
        nodeId,
        category: target.category,
        claims: [],
        name: target.newPluginDefaults,
      };
      aggregate.claims.push(...defaults.map((diff) => pathKey(diff.path)));
      newPluginDefaults.set(key, aggregate);
      continue;
    }
    for (const diff of defaults) {
      push(defaultsByNode, nodeId, {
        category: target.category,
        order: target.order,
        key: pathKey(diff.path),
        change: describeDefaultDiff(target, diff, describeCtx),
      });
    }
  }

  for (const { nodeId, category, claims, name } of newPluginDefaults.values()) {
    if (claims.length) {
      push(defaultsByNode, nodeId, {
        category,
        order: 0,
        key: '',
        change: describeNewPluginDefaults(category, name, claims),
      });
    }
  }

  const diffIndex = indexDiffs(diffs);
  for (const raw of structure.changes) {
    if (!raw.text && isUnset(raw.before) && isUnset(raw.after)) {
      bookkeeping.push(...raw.claims);
      continue;
    }
    const target = isRawDefault(raw, diffIndex) ? defaultsByNode : entriesByNode;
    const rawCtx = { diffsUnder: diffIndex.under, nodes: structure.nodes, list: listCtx };
    for (const { change, order } of describeRawChange(raw, rawCtx)) {
      push(target, raw.nodeId, { category: raw.category, order, key: '', change });
    }
  }

  const propertiesOf = (node: StructureNode): ReviewProperty[] => {
    const side = node.status === 'removed' ? baseline : payload;
    if (node.kind === 'panel' && node.elementName !== undefined) {
      return panelProperties(
        side,
        node.elementName,
        node.itemPath,
        isDefaultOn(side),
        (id) => getPlugin(id)?.meta?.name,
        ruleSetText
      );
    }
    if (node.kind !== 'section' || node.itemPath === undefined) {
      return [];
    }
    const hasContents =
      Boolean(node.movedIn?.length || node.removedContents?.length) ||
      structure.nodes.some((other) => other.parentId === node.id);
    return sectionProperties(side, node.itemPath, ruleSetText, hasContents);
  };
  const tree = buildTree(structure, entriesByNode, input.mode === 'new', propertiesOf);
  const metadata = describeMetadata(input.metadata);
  const systemDefaults = groupDefaults(structure.nodes, defaultsByNode);
  const flat = flatten(tree);
  const panels = flat.filter((node) => node.kind === 'panel').length;

  return {
    mode: input.mode,
    baselineKind: input.baselineKind,
    sourceTitle: input.sourceTitle,
    overview: {
      line: overviewLine(
        flat.some((node) => node.kind === 'dashboard'),
        topLevelCounts(tree, structure),
        input.mode === 'new'
      ),
      counts: countChanges(tree, metadata),
    },
    tree,
    metadata,
    systemDefaults,
    bookkeeping,
    collapsePanelsByDefault: panels > COLLAPSE_PANELS_ABOVE,
  };
}

function ownerKey(target: FieldTarget): string {
  return target.owner.kind === 'panel' ? `panel:${target.owner.element}` : 'dashboard';
}

function panelLabelsOf(
  element: string,
  baseline: DashboardV2Spec,
  payload: DashboardV2Spec,
  getPlugin: (id: string) => PanelPlugin | undefined
): PanelLabels {
  const spec = valueAt(payload, ['elements', element, 'spec']) ?? valueAt(baseline, ['elements', element, 'spec']);
  const pluginId = valueAt(spec, ['vizConfig', 'group']);
  const options = valueAt(spec, ['vizConfig', 'spec', 'options']);
  return getPanelLabels(
    typeof pluginId === 'string' ? getPlugin(pluginId) : undefined,
    typeof options === 'object' && options !== null ? { ...options } : {},
    valueAt(spec, ['vizConfig', 'spec', 'fieldConfig'])
  );
}

/** Diffs claimed but never shown (WORDING.md §11). */
function isBookkeeping(diff: Diff, baseline: DashboardV2Spec, payload: DashboardV2Spec): boolean {
  if (diff.path[0] === 'revision') {
    return true;
  }
  if (diff.path[0] === 'elements' && diff.path.length === 4 && diff.path[2] === 'spec' && diff.path[3] === 'id') {
    const element = ['elements', diff.path[1]];
    const beforeKind = valueAt(baseline, [...element, 'kind']);
    const afterKind = valueAt(payload, [...element, 'kind']);
    return beforeKind !== undefined && beforeKind === afterKind;
  }
  return false;
}

/** Inside a list, only an item that stays at its index can have defaults filled in: anything else is shift noise. */
function mayBeDefault(
  target: FieldTarget,
  diff: Diff,
  baseline: DashboardV2Spec,
  payload: DashboardV2Spec,
  ctx: DescribeContext
): boolean {
  const { describe } = target;
  if (target.neverDefault) {
    return false;
  }
  if (describe.type === 'namedList') {
    const index = diff.path[target.path.length];
    if (index === undefined) {
      return true;
    }
    const items = listItemsOf(describe.list, ctx.listKind(target));
    const before = asArray(valueAt(baseline, target.path))[Number(index)];
    const after = asArray(valueAt(payload, target.path))[Number(index)];
    return before !== undefined && after !== undefined && items.keyOf(before) === items.keyOf(after);
  }
  return true;
}

interface DiffIndex {
  /** The diffs a set of claims covers, without scanning every diff per claim. */
  under(claims: PathKey[]): Diff[];
}

function indexDiffs(diffs: Diff[]): DiffIndex {
  const sorted = diffs.map((diff) => ({ key: pathKey(diff.path), diff })).sort((a, b) => compareKeys(a.key, b.key));
  const lowerBound = (key: string) => {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sorted[middle].key < key) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  };
  return {
    under: (claims) => {
      const found = new Set<Diff>();
      for (const claim of claims) {
        // Keys under `claim/` sort right after `claim` itself, but other keys such as `claim-x` may sit between.
        for (let index = lowerBound(claim); index < sorted.length && sorted[index].key.startsWith(claim); index++) {
          if (claimCovers(claim, sorted[index].key)) {
            found.add(sorted[index].diff);
          }
        }
      }
      return [...found];
    },
  };
}

/** A layout value the payload fills in where the baseline had none, equal to that field's default. */
function isRawDefault(raw: RawChange, diffIndex: DiffIndex): boolean {
  if (raw.text || raw.before !== undefined || raw.after === undefined || !raw.claims.length) {
    return false;
  }
  if (!isEqual(raw.after, rawFieldDefault(raw))) {
    return false;
  }
  const covered = diffIndex.under(raw.claims);
  return covered.length > 0 && covered.every((diff) => diff.op === 'add');
}

function buildTree(
  structure: Structure,
  entriesByNode: Map<string, NodeEntry[]>,
  isNew: boolean,
  propertiesOf: (node: StructureNode) => ReviewProperty[]
): ReviewNode[] {
  const nodeById = new Map(structure.nodes.map((node) => [node.id, node]));
  const removedAncestor = (node: StructureNode): StructureNode | undefined => {
    let parent = node.parentId ? nodeById.get(node.parentId) : undefined;
    let found: StructureNode | undefined;
    while (parent) {
      if (parent.status === 'removed') {
        found = parent;
      }
      parent = parent.parentId ? nodeById.get(parent.parentId) : undefined;
    }
    return found;
  };

  // Nodes removed with a removed section are named in its "removed with it" list; their claims go to it.
  const extraClaims = new Map<string, PathKey[]>();
  const hidden = new Set<string>();
  for (const node of structure.nodes) {
    const ancestor = removedAncestor(node);
    if (ancestor) {
      hidden.add(node.id);
      const claims = [...node.claims, ...(entriesByNode.get(node.id) ?? []).flatMap((entry) => entry.change.claims)];
      extraClaims.set(ancestor.id, [...(extraClaims.get(ancestor.id) ?? []), ...claims]);
    }
  }

  const reviewNodes = new Map<string, ReviewNode>();
  const hasOwn = new Set<string>();
  for (const node of structure.nodes) {
    if (hidden.has(node.id)) {
      continue;
    }
    const entries = entriesByNode.get(node.id) ?? [];
    const claims = [...node.claims, ...(extraClaims.get(node.id) ?? [])];
    let categories: ReviewCategoryGroup[] = [];
    if (node.status === 'added' || node.status === 'removed') {
      claims.push(...entries.flatMap((entry) => entry.change.claims));
    } else {
      categories = groupByCategory(node, entries);
    }
    if (node.status || categories.length || claims.length) {
      hasOwn.add(node.id);
    }
    const reviewNode = toReviewNode(node, categories, claims, isNew);
    if (node.status === 'added' || node.status === 'removed') {
      const properties = propertiesOf(node);
      if (properties.length) {
        reviewNode.properties = properties;
      }
    }
    reviewNodes.set(node.id, reviewNode);
  }

  // A section is shown with its own changes, or as a header for a changed panel directly inside it.
  const shown = new Set(hasOwn);
  for (const node of structure.nodes) {
    if (node.kind === 'panel' && hasOwn.has(node.id) && node.parentId && !hidden.has(node.id)) {
      shown.add(node.parentId);
    }
  }

  const tree: ReviewNode[] = [];
  for (const node of structure.nodes) {
    const reviewNode = reviewNodes.get(node.id);
    if (!reviewNode || !shown.has(node.id)) {
      continue;
    }
    let parentId = node.parentId;
    while (parentId && !shown.has(parentId)) {
      parentId = nodeById.get(parentId)?.parentId;
    }
    reviewNode.label = nodeHeader(node, parentId === node.parentId);
    const parent = parentId ? reviewNodes.get(parentId) : undefined;
    if (parent?.kind === 'section' && reviewNode.kind !== 'dashboard') {
      parent.children.push(reviewNode);
    } else {
      tree.push(reviewNode);
    }
  }
  for (const node of reviewNodes.values()) {
    if (node.kind === 'section' && node.status === 'added') {
      const added = node.children
        .filter((child) => child.status === 'added' && nodeById.get(child.id)?.parentId === node.id)
        .map((child) => (child.kind === 'section' ? child.sectionKind : 'panel'));
      node.statusText = sectionContentsText(
        (node.movedIn ?? []).map((entry) => entry.name),
        added
      );
    }
  }
  const dashboard = tree.filter((node) => node.kind === 'dashboard');
  return [...dashboard, ...tree.filter((node) => node.kind !== 'dashboard')];
}

function groupByCategory(node: StructureNode, entries: NodeEntry[]): ReviewCategoryGroup[] {
  const order: readonly ReviewCategory[] = CATEGORY_ORDER[node.kind];
  const known = new Set<ReviewCategory>(order);
  return [...order, ...[...new Set(entries.map((entry) => entry.category))].filter((c) => !known.has(c))]
    .map((category) => {
      const changes = entries
        .filter((entry) => entry.category === category)
        .sort(compareEntries)
        .map((entry) => entry.change);
      const note = changes.find((change) => change.categoryNote)?.categoryNote;
      return { category, label: categoryLabel(category), ...(note && { note }), changes };
    })
    .filter((group) => group.changes.length > 0);
}

/**
 * A node's header: its own name, "Added"/"Removed" when it was, and "under <its section>" when the tree shows it
 * somewhere other than directly in that section (a compressed ancestor). Panels never need "under": their
 * section is always shown, or they sit at the top level.
 */
function nodeHeader(node: StructureNode, inDirectParent: boolean): RichText {
  if (node.kind === 'dashboard') {
    return [t('dashboard-scene.review.node.dashboard', 'Dashboard')];
  }
  const name = asSelf(node.name ?? []);
  const parent = node.kind === 'section' && !inDirectParent ? node.parentPath : undefined;
  if (node.status === 'added') {
    return parent
      ? rich({ name, parent }, (p) =>
          t('dashboard-scene.review.node.added-under', 'Added {{name}} under {{parent}}', {
            ...p,
            interpolation: noEscape,
          })
        )
      : rich({ name }, (p) =>
          t('dashboard-scene.review.node.added', 'Added {{name}}', { ...p, interpolation: noEscape })
        );
  }
  if (node.status === 'removed') {
    return parent
      ? rich({ name, parent }, (p) =>
          t('dashboard-scene.review.node.removed-under', 'Removed {{name}} under {{parent}}', {
            ...p,
            interpolation: noEscape,
          })
        )
      : rich({ name }, (p) =>
          t('dashboard-scene.review.node.removed', 'Removed {{name}}', { ...p, interpolation: noEscape })
        );
  }
  return parent
    ? rich({ name, parent }, (p) =>
        t('dashboard-scene.review.node.under', '{{name}} under {{parent}}', { ...p, interpolation: noEscape })
      )
    : name;
}

function toReviewNode(
  node: StructureNode,
  categories: ReviewCategoryGroup[],
  claims: PathKey[],
  isNew: boolean
): ReviewNode {
  const lines = categories.reduce(
    (total, group) => total + group.changes.reduce((sum, change) => sum + changeCount(change), 0),
    0
  );
  const base = {
    id: node.id,
    label: nodeHeader(node, true),
    status: node.status,
    // In a new dashboard everything is new: "was updated" would say nothing.
    // An added section's contents are counted once its children are known (buildTree).
    statusText: isNew && node.kind === 'dashboard' ? undefined : nodeStatusText(node.status, node.move, lines),
    summary: nodeSummary(categories.map((group) => group.category)),
    categories,
    claims,
  };
  if (node.kind === 'section') {
    const section: SectionReviewNode = {
      ...base,
      kind: 'section',
      sectionKind: node.sectionKind ?? 'row',
      children: [],
      removedContents: node.removedContents,
      movedIn: node.movedIn,
    };
    return section;
  }
  return node.kind === 'panel' ? { ...base, kind: 'panel' } : { ...base, kind: 'dashboard' };
}

function groupDefaults(nodes: StructureNode[], defaultsByNode: Map<string, NodeEntry[]>): SystemDefaultGroup[] {
  return nodes
    .filter((node) => defaultsByNode.get(node.id)?.length)
    .map((node) => {
      const order: readonly ReviewCategory[] = CATEGORY_ORDER[node.kind];
      const rank = (category: ReviewCategory) => {
        const index = order.indexOf(category);
        return index === -1 ? order.length : index;
      };
      const changes = [...defaultsByNode.get(node.id)!]
        .sort((a, b) => rank(a.category) - rank(b.category) || compareEntries(a, b))
        .map((entry) => entry.change);
      return { label: node.ownerLabel ?? nodeHeader(node, true), changes };
    });
}

/**
 * The top-level rows, tabs and panels the tree shows changes in. A node shown at the root under a compressed
 * parent ("Added Row "Cache" under Tab "Tab 1"") counts as a change to that top-level parent, and a panel moved
 * between sections as a change to both ends.
 */
function topLevelCounts(tree: ReviewNode[], structure: Structure): TopLevelCounts {
  const nodeById = new Map(structure.nodes.map((node) => [node.id, node]));
  const topLevel = new Map<string, StructureNode>();
  const add = (id: string) => {
    let node = nodeById.get(id);
    while (node?.parentId && nodeById.has(node.parentId)) {
      node = nodeById.get(node.parentId);
    }
    if (node && node.kind !== 'dashboard') {
      topLevel.set(node.id, node);
    }
  };
  for (const node of flatten(tree)) {
    if (tree.includes(node)) {
      add(node.id);
    }
    // The section a node moved out of lost it: a change there too.
    const movedFrom = nodeById.get(node.id)?.movedFromId;
    if (movedFrom) {
      add(movedFrom);
    }
  }
  const nodes = [...topLevel.values()];
  return {
    rows: nodes.filter((node) => node.kind === 'section' && node.sectionKind === 'row').length,
    tabs: nodes.filter((node) => node.kind === 'section' && node.sectionKind === 'tab').length,
    panels: nodes.filter((node) => node.kind === 'panel').length,
  };
}

function flatten(tree: ReviewNode[]): ReviewNode[] {
  return tree.flatMap((node) => (node.kind === 'section' ? [node, ...flatten(node.children)] : [node]));
}

function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Within a category: by rule order, then path, then the order the diffs came in. */
function compareEntries(a: NodeEntry, b: NodeEntry): number {
  return a.order - b.order || compareKeys(a.key, b.key) || a.sequence - b.sequence;
}
