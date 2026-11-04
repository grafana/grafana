import { isEqual } from 'lodash';

import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type Diff } from '../../../settings/version-history/utils';
import { unescapeSegment } from '../describe/paths';
import {
  type ChangeKind,
  type PathKey,
  type RawChange,
  type ReviewCategory,
  type Structure,
  type StructureFieldKey,
  type StructureNode,
} from '../types';

import { longestCommonSubsequence } from './lcs';
import { matchSections, type SectionMatching } from './matchSections';
import { joinPath, nameSide, type SideNames } from './naming';
import {
  childArrayKey,
  isPanelLayoutKind,
  type LayoutKindName,
  type WalkedContainer,
  type WalkedLayout,
  type WalkedPlacement,
  type WalkedSection,
  walkLayout,
} from './walkLayout';

const noEscape = { escapeValue: false };

export const DASHBOARD_NODE_ID = 'dashboard';

type Side = 'baseline' | 'payload';

/** Who a diff path is attributed to: a node's status, or one of the RawChanges. */
type ClaimTarget = { node: StructureNode } | { change: RawChange };

/**
 * A structural event in one layout array (an item entering, leaving or changing order), which index-shift
 * noise in that array is attributed to.
 */
interface ArrayEvent {
  identity: string;
  index: number;
  target: ClaimTarget;
}

const SECTION_FIELDS: Array<{ field: StructureFieldKey; category: ReviewCategory; rowOnly?: boolean }> = [
  { field: 'title', category: 'properties' },
  { field: 'hideHeader', category: 'properties', rowOnly: true },
  { field: 'fillScreen', category: 'properties', rowOnly: true },
  { field: 'collapse', category: 'properties', rowOnly: true },
  { field: 'repeat', category: 'repeat' },
  { field: 'conditionalRendering', category: 'showHide' },
  { field: 'variables', category: 'controls' },
  { field: 'annotations', category: 'controls' },
];

/** Auto grid settings in the order the layout options list them. */
const AUTO_GRID_SETTINGS = [
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
];

function settingRank(key: string): number {
  const rank = AUTO_GRID_SETTINGS.indexOf(key);
  return rank === -1 ? AUTO_GRID_SETTINGS.length : rank;
}

const PANEL_ITEM_FIELDS = new Map<string, StructureFieldKey>([
  ['x', 'position'],
  ['y', 'position'],
  ['width', 'size'],
  ['height', 'size'],
  ['repeat', 'repeat'],
  ['conditionalRendering', 'conditionalRendering'],
  ['fitContent', 'fitContent'],
]);

/**
 * Matches dashboard, section and panel identities across both specs, names and orders the nodes,
 * and finds the semantic changes inside `layout`. `layoutDiffs` are the jsonDiff entries under `layout`
 * plus whole-element adds and removes (`elements/<name>`); each must end up claimed exactly once.
 *
 * Restructures: when a layout's kind changes, one `layoutType` change on the layout's owner claims every
 * diff inside that layout. Panels that leave a layout whose kind changed between holding panels and holding
 * sections (grid → rows, tabs → grid), or that leave or enter a section that only exists on one side of
 * such a change, are not marked moved: the layout change explains them. Moves between sections that exist
 * on both sides still are.
 */
export function buildStructure(baseline: DashboardV2Spec, payload: DashboardV2Spec, layoutDiffs: Diff[]): Structure {
  const walked: Record<Side, WalkedLayout> = {
    baseline: walkLayout(baseline.layout),
    payload: walkLayout(payload.layout),
  };
  const matching = matchSections(walked.baseline, walked.payload);
  const names: Record<Side, SideNames> = {
    baseline: nameSide(walked.baseline, baseline.elements),
    payload: nameSide(walked.payload, payload.elements),
  };
  const builder = new StructureBuilder(baseline, payload, walked, matching, names);
  return builder.build(layoutDiffs);
}

class StructureBuilder {
  private nodeById = new Map<string, StructureNode>();
  private changes: RawChange[] = [];
  private changeByKey = new Map<string, RawChange>();
  private events = new Map<string, ArrayEvent[]>();
  private fallbackByOwner = new Map<string, RawChange>();
  /** Moved nodes by id: the baseline section a panel came from, or `sameSection` for a reorder among siblings. */
  private moves = new Map<string, { sameSection: true } | { sameSection: false; fromSectionPath?: PathKey }>();

  constructor(
    private baseline: DashboardV2Spec,
    private payload: DashboardV2Spec,
    private walked: Record<Side, WalkedLayout>,
    private matching: SectionMatching,
    private names: Record<Side, SideNames>
  ) {}

  build(layoutDiffs: Diff[]): Structure {
    this.findMoves();
    this.createNodes();
    this.findChanges();
    this.findEvents();
    for (const diff of layoutDiffs) {
      const target = this.resolve(diff.path);
      if (target) {
        const key = diff.path.join('/');
        const claims = 'node' in target ? target.node.claims : target.change.claims;
        if (!claims.includes(key)) {
          claims.push(key);
        }
      }
    }

    const nodes = this.orderNodes();
    const order = new Map(nodes.map((node, index) => [node.id, index]));
    const changes = [...this.changes].sort((a, b) => (order.get(a.nodeId) ?? 0) - (order.get(b.nodeId) ?? 0));
    const panelIds = new Map<string, string>();
    for (const node of nodes) {
      if (node.elementName !== undefined) {
        panelIds.set(node.elementName, node.id);
      }
    }
    return { nodes, changes, panelNodeId: (elementName) => panelIds.get(elementName) };
  }

  // Identity

  sectionId(side: Side, path: PathKey): string {
    if (side === 'payload') {
      return `section:${path}`;
    }
    const matched = this.matching.baselineToPayload.get(path);
    return matched !== undefined ? `section:${matched}` : `section-removed:${path}`;
  }

  panelId(elementName: string): string {
    return `panel:${elementName}`;
  }

  private parentOf(side: Side, sectionPath: PathKey | undefined): string | undefined {
    return sectionPath === undefined ? undefined : this.sectionId(side, sectionPath);
  }

  /** Node ids of a placement's owner and every section above it, nearest first, ending with the dashboard. */
  private ownerChain(side: Side, sectionPath: PathKey | undefined): string[] {
    const chain: string[] = [];
    let path = sectionPath;
    while (path !== undefined) {
      chain.push(this.sectionId(side, path));
      path = this.walked[side].sectionByPath.get(path)?.parentPath;
    }
    chain.push(DASHBOARD_NODE_ID);
    return chain;
  }

  // Nodes

  private createNodes() {
    this.addNode({
      id: DASHBOARD_NODE_ID,
      kind: 'dashboard',
      label: t('dashboard-scene.review.node.dashboard', 'Dashboard'),
      claims: [],
    });

    for (const section of this.walked.payload.sections) {
      const matched = this.matching.payloadToBaseline.has(section.path);
      this.addNode({
        id: this.sectionId('payload', section.path),
        kind: 'section',
        sectionKind: section.kind,
        label: this.payloadLabel(this.sectionId('payload', section.path)),
        parentId: this.parentOf('payload', section.parentPath),
        ...(matched ? this.moveStatus(this.sectionId('payload', section.path)) : { status: 'added' as const }),
        claims: [],
      });
    }

    for (const section of this.walked.baseline.sections) {
      if (this.matching.baselineToPayload.has(section.path)) {
        continue;
      }
      const parentRemoved =
        section.parentPath !== undefined && !this.matching.baselineToPayload.has(section.parentPath);
      this.addNode({
        id: this.sectionId('baseline', section.path),
        kind: 'section',
        sectionKind: section.kind,
        label: this.names.baseline.sections.get(section.path)!,
        parentId: this.parentOf('baseline', section.parentPath),
        ...(parentRemoved ? {} : { status: 'removed' as const, removedContents: this.removedContents(section) }),
        claims: [],
      });
    }

    const baselineElements = this.baseline.elements ?? {};
    const payloadElements = this.payload.elements ?? {};
    for (const name of Object.keys(payloadElements)) {
      const placement = this.walked.payload.placementByElement.get(name);
      const node: StructureNode = {
        id: this.panelId(name),
        kind: 'panel',
        elementName: name,
        label: this.payloadLabel(this.panelId(name)),
        ownerLabel: this.names.payload.owners.get(name),
        parentId: this.parentOf('payload', placement?.sectionPath),
        claims: [],
      };
      Object.assign(
        node,
        Object.hasOwn(baselineElements, name) ? this.moveStatus(node.id) : { status: 'added' as const }
      );
      this.addNode(node);
    }

    for (const name of Object.keys(baselineElements)) {
      if (Object.hasOwn(payloadElements, name)) {
        continue;
      }
      const placement = this.walked.baseline.placementByElement.get(name);
      const parentId = this.parentOf('baseline', placement?.sectionPath);
      // Deleted along with a removed section: listed in that section's removedContents instead.
      const inRemovedSection = parentId?.startsWith('section-removed:') ?? false;
      const removed: StructureNode = {
        id: this.panelId(name),
        kind: 'panel',
        elementName: name,
        label: this.names.baseline.panels.get(name)!.label,
        ownerLabel: this.names.baseline.owners.get(name),
        parentId,
        ...(inRemovedSection ? {} : { status: 'removed' as const }),
        claims: [],
      };
      this.addNode(removed);
    }
  }

  /**
   * A payload node's header. A moved node whose name is ambiguous drops its position from the header:
   * the move text ends with its new position instead.
   */
  private payloadLabel(nodeId: string): string {
    const moved = this.moves.has(nodeId);
    if (nodeId.startsWith('panel:')) {
      const panel = this.names.payload.panels.get(nodeId.slice('panel:'.length))!;
      return moved ? panel.name : panel.label;
    }
    const path = nodeId.slice('section:'.length);
    if (!moved) {
      return this.names.payload.sections.get(path)!;
    }
    const segment = this.names.payload.segments.get(path)!;
    const parentPath = this.walked.payload.sectionByPath.get(path)?.parentPath;
    return parentPath !== undefined
      ? joinPath(this.names.payload.sections.get(parentPath)!, segment.name)
      : segment.name;
  }

  private addNode(node: StructureNode) {
    this.nodeById.set(node.id, node);
  }

  /** Panels deleted with a removed section and its nested sections, in baseline reading order. */
  private removedContents(section: WalkedSection): string[] {
    const payloadElements = this.payload.elements ?? {};
    const contents: string[] = [];
    // Listed under the removed section's header, so nested sections are named relative to it.
    const visit = (container: WalkedContainer, prefix?: string) => {
      for (const placement of container.placements) {
        if (!Object.hasOwn(payloadElements, placement.elementName)) {
          contents.push(this.names.baseline.panels.get(placement.elementName)!.label);
        }
      }
      for (const child of container.sections) {
        // A nested section kept its identity elsewhere (unwrapped by a restructure): not removed.
        if (this.matching.baselineToPayload.has(child.path)) {
          continue;
        }
        const segment = this.names.baseline.segments.get(child.path)!.label;
        const relative = prefix ? joinPath(prefix, segment) : segment;
        contents.push(relative);
        visit(child.container, relative);
      }
    };
    visit(section.container);
    return contents;
  }

  /** The baseline owner a panel moved from, or undefined when it didn't move (or a restructure explains it). */
  private movedFrom(name: string): { sectionPath: PathKey | undefined } | undefined {
    const before = this.walked.baseline.placementByElement.get(name);
    const after = this.walked.payload.placementByElement.get(name);
    if (!before || !after) {
      return undefined;
    }
    const beforeChain = this.ownerChain('baseline', before.sectionPath);
    const afterChain = this.ownerChain('payload', after.sectionPath);
    if (beforeChain[0] === afterChain[0]) {
      return undefined;
    }
    const survives = (id: string) => id !== DASHBOARD_NODE_ID && this.isMatchedSectionId(id);
    const explained = beforeChain.some(
      (id) =>
        this.isRestructured(id) &&
        afterChain.includes(id) &&
        (!survives(beforeChain[0]) || !survives(afterChain[0]) || beforeChain[0] === id || afterChain[0] === id)
    );
    return explained ? undefined : { sectionPath: before.sectionPath };
  }

  private isMatchedSectionId(id: string): boolean {
    return id.startsWith('section:') && this.matching.payloadToBaseline.has(id.slice('section:'.length));
  }

  private isRestructured(ownerId: string): boolean {
    const pair = this.containerPair(ownerId);
    return pair !== undefined && pair[0].kind !== pair[1].kind;
  }

  /** Panels moved to another section, and panels and sections that left the common order among their siblings. */
  private findMoves() {
    const baselineElements = this.baseline.elements ?? {};
    for (const name of Object.keys(this.payload.elements ?? {})) {
      if (!Object.hasOwn(baselineElements, name)) {
        continue;
      }
      const from = this.movedFrom(name);
      if (from) {
        this.moves.set(this.panelId(name), { sameSection: false, fromSectionPath: from.sectionPath });
      }
    }

    for (const ownerId of this.matchedOwners()) {
      const [before, after] = this.containerPair(ownerId)!;
      if (isPanelLayoutKind(before.kind) !== isPanelLayoutKind(after.kind)) {
        continue;
      }
      const beforeIds = this.readingOrder(before, 'baseline');
      const afterIds = this.readingOrder(after, 'payload');
      const common = new Set(afterIds.filter((id) => beforeIds.includes(id)));
      const beforeCommon = beforeIds.filter((id) => common.has(id));
      const afterCommon = afterIds.filter((id) => common.has(id));
      const stable = (id: string) => this.coordinatesUnchanged(before, after, id);
      const kept = new Set(longestCommonSubsequence(beforeCommon, afterCommon, stable));
      for (const id of afterCommon) {
        if (!kept.has(id)) {
          this.moves.set(id, { sameSection: true });
        }
      }
    }
  }

  /** Grid coordinates of a panel unchanged; always true for items without coordinates. */
  private coordinatesUnchanged(before: WalkedContainer, after: WalkedContainer, id: string): boolean {
    const a = before.placements.find((p) => this.panelId(p.elementName) === id);
    const b = after.placements.find((p) => this.panelId(p.elementName) === id);
    if (a?.layoutKind !== 'GridLayout' || b?.layoutKind !== 'GridLayout') {
      return true;
    }
    return a.item.x === b.item.x && a.item.y === b.item.y;
  }

  /**
   * A moved node's status: the move text, and its new position when its name is ambiguous (its header then
   * shows the name only). describe/ composes the final statusText from both.
   */
  private moveStatus(nodeId: string): Pick<StructureNode, 'status' | 'moveText' | 'movePosition'> {
    const move = this.moves.get(nodeId);
    if (!move) {
      return {};
    }
    const own = this.payloadName(nodeId);
    return {
      status: 'moved',
      moveText: this.moveRelation(nodeId, move),
      ...(own?.ambiguous ? { movePosition: own.position } : {}),
    };
  }

  /** Where a moved node is now, relative to its neighbour among its new siblings, and where it came from. */
  private moveRelation(
    nodeId: string,
    move: { sameSection: true } | { sameSection: false; fromSectionPath?: PathKey }
  ): string {
    const siblings = this.payloadSiblings(nodeId);
    const index = siblings.indexOf(nodeId);
    const previous = index > 0 ? this.neighbourName(siblings[index - 1]) : undefined;
    const next = index >= 0 && index < siblings.length - 1 ? this.neighbourName(siblings[index + 1]) : undefined;

    if (move.sameSection) {
      return previous !== undefined
        ? t('dashboard-scene.review.status.moved-after', 'moved after {{node}}', {
            node: previous,
            interpolation: noEscape,
          })
        : t('dashboard-scene.review.status.moved-before', 'moved before {{node}}', {
            node: next ?? '',
            interpolation: noEscape,
          });
    }

    const source = this.sourceLabel(move.fromSectionPath);
    const destination = this.destinationLabel(nodeId);
    if (previous !== undefined) {
      return t(
        'dashboard-scene.review.status.moved-between-after',
        'moved from {{source}} to {{destination}}, after {{node}}',
        { source, destination, node: previous, interpolation: noEscape }
      );
    }
    if (next !== undefined) {
      return t(
        'dashboard-scene.review.status.moved-between-before',
        'moved from {{source}} to {{destination}}, before {{node}}',
        { source, destination, node: next, interpolation: noEscape }
      );
    }
    return t('dashboard-scene.review.status.moved-between', 'moved from {{source}} to {{destination}}', {
      source,
      destination,
      interpolation: noEscape,
    });
  }

  /** The new section's full path, or the top level for the root. */
  private destinationLabel(nodeId: string): string {
    const sectionPath = nodeId.startsWith('panel:')
      ? this.walked.payload.placementByElement.get(nodeId.slice('panel:'.length))?.sectionPath
      : this.walked.payload.sectionByPath.get(nodeId.slice('section:'.length))?.parentPath;
    return sectionPath === undefined ? topLevel() : this.names.payload.sections.get(sectionPath)!;
  }

  /** The old section's full path: its current name when it still exists, its baseline name when removed. */
  private sourceLabel(sectionPath: PathKey | undefined): string {
    if (sectionPath === undefined) {
      return topLevel();
    }
    const payloadPath = this.matching.baselineToPayload.get(sectionPath);
    return payloadPath !== undefined
      ? this.names.payload.sections.get(payloadPath)!
      : this.names.baseline.sections.get(sectionPath)!;
  }

  /** Payload ids of the node's siblings (its new section's children), in reading order. */
  private payloadSiblings(nodeId: string): string[] {
    let container: WalkedContainer | undefined;
    if (nodeId.startsWith('panel:')) {
      const placement = this.walked.payload.placementByElement.get(nodeId.slice('panel:'.length));
      container = placement && this.payloadContainerOf(placement.sectionPath);
    } else {
      const section = this.walked.payload.sectionByPath.get(nodeId.slice('section:'.length));
      container = section && this.payloadContainerOf(section.parentPath);
    }
    return container ? this.readingOrder(container, 'payload') : [];
  }

  private payloadContainerOf(sectionPath: PathKey | undefined): WalkedContainer | undefined {
    return sectionPath === undefined
      ? this.walked.payload.root
      : this.walked.payload.sectionByPath.get(sectionPath)?.container;
  }

  /** A neighbour's name, without a position: being next to the moved node identifies it. */
  private neighbourName(id: string): string {
    if (id.startsWith('panel:')) {
      return this.names.payload.panels.get(id.slice('panel:'.length))?.name ?? '';
    }
    return this.names.payload.segments.get(id.slice('section:'.length))?.name ?? '';
  }

  /** The moved node's own name among its new siblings. */
  private payloadName(id: string) {
    return id.startsWith('panel:')
      ? this.names.payload.panels.get(id.slice('panel:'.length))
      : this.names.payload.segments.get(id.slice('section:'.length));
  }

  /** Baseline and payload layouts of an owner that exists on both sides. */
  private containerPair(ownerId: string): [WalkedContainer, WalkedContainer] | undefined {
    if (ownerId === DASHBOARD_NODE_ID) {
      return [this.walked.baseline.root, this.walked.payload.root];
    }
    if (!ownerId.startsWith('section:')) {
      return undefined;
    }
    const payloadPath = ownerId.slice('section:'.length);
    const baselinePath = this.matching.payloadToBaseline.get(payloadPath);
    if (baselinePath === undefined) {
      return undefined;
    }
    return [
      this.walked.baseline.sectionByPath.get(baselinePath)!.container,
      this.walked.payload.sectionByPath.get(payloadPath)!.container,
    ];
  }

  /** Every owner on both sides: the dashboard, then matched sections in payload order. */
  private matchedOwners(): string[] {
    return [
      DASHBOARD_NODE_ID,
      ...this.walked.payload.sections
        .filter((section) => this.matching.payloadToBaseline.has(section.path))
        .map((section) => this.sectionId('payload', section.path)),
    ];
  }

  // Changes

  /** `setting` tells apart the several layoutSettings changes of one layout. */
  private addChange(change: Omit<RawChange, 'claims' | 'kind'> & { kind?: ChangeKind }, setting?: string): RawChange {
    const full: RawChange = { kind: kindOf(change.before, change.after), ...change, claims: [] };
    this.changes.push(full);
    this.changeByKey.set(changeKey(full.nodeId, full.field, setting), full);
    return full;
  }

  private change(nodeId: string, field: StructureFieldKey, setting?: string): RawChange | undefined {
    return this.changeByKey.get(changeKey(nodeId, field, setting));
  }

  private findChanges() {
    for (const ownerId of this.matchedOwners()) {
      const [before, after] = this.containerPair(ownerId)!;
      if (before.kind !== after.kind) {
        this.addChange({
          nodeId: ownerId,
          category: 'layout',
          field: 'layoutType',
          kind: 'changed',
          before: before.kind,
          after: after.kind,
          text: t('dashboard-scene.review.structure.layout-type', 'Layout: changed from {{before}} to {{after}}', {
            before: layoutKindName(before.kind),
            after: layoutKindName(after.kind),
            interpolation: noEscape,
          }),
        });
      }
    }

    for (const section of this.walked.payload.sections) {
      const baselinePath = this.matching.payloadToBaseline.get(section.path);
      if (baselinePath !== undefined) {
        this.findSectionChanges(this.walked.baseline.sectionByPath.get(baselinePath)!, section);
      }
    }

    for (const ownerId of this.matchedOwners()) {
      const [before, after] = this.containerPair(ownerId)!;
      if (before.kind !== after.kind) {
        continue;
      }
      if (before.kind === 'AutoGridLayout' && after.kind === 'AutoGridLayout') {
        this.findLayoutSettingsChange(ownerId, before, after);
      }
      if (isPanelLayoutKind(after.kind)) {
        this.findPanelItemChanges(ownerId, before, after);
      }
    }
  }

  private findSectionChanges(before: WalkedSection, after: WalkedSection) {
    const nodeId = this.sectionId('payload', after.path);
    const beforeSpec: Record<string, unknown> = { ...before.spec };
    const afterSpec: Record<string, unknown> = { ...after.spec };
    for (const { field, category, rowOnly } of SECTION_FIELDS) {
      if (rowOnly && (before.kind !== 'row' || after.kind !== 'row')) {
        continue;
      }
      if (!isEqual(beforeSpec[field], afterSpec[field])) {
        this.addChange({ nodeId, category, field, before: beforeSpec[field], after: afterSpec[field] });
      }
    }
  }

  private findLayoutSettingsChange(ownerId: string, before: WalkedContainer, after: WalkedContainer) {
    const settings = (container: WalkedContainer): Record<string, unknown> => {
      if (container.layout.kind !== 'AutoGridLayout') {
        return {};
      }
      const { items, ...rest } = container.layout.spec ?? {};
      return { ...rest };
    };
    const beforeSettings = settings(before);
    const afterSettings = settings(after);
    const keys = [...new Set([...Object.keys(beforeSettings), ...Object.keys(afterSettings)])].sort(
      (a, b) => settingRank(a) - settingRank(b) || (a < b ? -1 : a > b ? 1 : 0)
    );
    for (const key of keys) {
      const beforeValue = ownValue(beforeSettings, key);
      const afterValue = ownValue(afterSettings, key);
      if (!isEqual(beforeValue, afterValue)) {
        this.addChange(
          {
            nodeId: ownerId,
            category: 'layout',
            field: 'layoutSettings',
            subField: key,
            before: beforeValue,
            after: afterValue,
          },
          key
        );
      }
    }
  }

  private findPanelItemChanges(ownerId: string, before: WalkedContainer, after: WalkedContainer) {
    const beforeByName = new Map(before.placements.map((p) => [p.elementName, p]));
    const common = after.placements.filter((p) => beforeByName.has(p.elementName));
    const isMoved = (p: WalkedPlacement) => this.moves.get(this.panelId(p.elementName))?.sameSection === true;
    const entersOrLeaves = after.placements.length !== common.length || before.placements.length !== common.length;
    const reordered = common.some(isMoved);

    const pending: Array<() => void> = [];
    let sizeChanged = false;
    for (const placement of common) {
      const nodeId = this.panelId(placement.elementName);
      const prev = beforeByName.get(placement.elementName)!;
      if (prev.layoutKind === 'GridLayout' && placement.layoutKind === 'GridLayout') {
        const a = prev.item;
        const b = placement.item;
        if (a.width !== b.width || a.height !== b.height) {
          sizeChanged = true;
          this.addChange({
            nodeId,
            category: 'layout',
            field: 'size',
            kind: 'changed',
            before: { width: a.width, height: a.height },
            after: { width: b.width, height: b.height },
          });
        }
        // A panel whose reading order changed is moved (its status says so); position words only the rest.
        if ((a.x !== b.x || a.y !== b.y) && !isMoved(placement)) {
          const onlyShifted = a.x === b.x;
          pending.push(() => {
            // Panels pushed up or down by an added, removed, resized or moved panel keep their order and
            // column: the grid moved them, not the user.
            if (onlyShifted && (entersOrLeaves || sizeChanged || reordered)) {
              return;
            }
            this.addChange({
              nodeId,
              category: 'layout',
              field: 'position',
              kind: 'changed',
              before: { x: a.x, y: a.y },
              after: { x: b.x, y: b.y },
            });
          });
        }
      }
      for (const field of ['repeat', 'conditionalRendering', 'fitContent'] as const) {
        const a = itemValue(prev, field);
        const b = itemValue(placement, field);
        if (!isEqual(a, b)) {
          const category = field === 'conditionalRendering' ? 'showHide' : 'layout';
          this.addChange({ nodeId, category, field, before: a, after: b });
        }
      }
    }
    pending.forEach((add) => add());
  }

  // Claims

  /** Structural events per owner's child array, for attributing index-shift noise. */
  private findEvents() {
    for (const ownerId of this.matchedOwners()) {
      const [before, after] = this.containerPair(ownerId)!;
      if (before.kind !== after.kind) {
        continue;
      }
      const events: ArrayEvent[] = [];
      const beforeItems = this.children(before, 'baseline');
      const afterItems = this.children(after, 'payload');
      const beforeIds = new Set(beforeItems.map((item) => item.identity));
      const afterIds = new Set(afterItems.map((item) => item.identity));

      for (const item of afterItems) {
        const node = this.nodeById.get(item.nodeId);
        if (!beforeIds.has(item.identity)) {
          if (node?.status) {
            events.push({ identity: item.identity, index: item.index, target: { node } });
          }
          continue;
        }
        const movedNode = this.moves.has(item.nodeId) ? node : undefined;
        if (movedNode) {
          events.push({ identity: item.identity, index: item.index, target: { node: movedNode } });
          continue;
        }
        const own = this.change(item.nodeId, 'position') ?? this.change(item.nodeId, 'size');
        if (own) {
          events.push({ identity: item.identity, index: item.index, target: { change: own } });
        }
      }
      for (const item of beforeItems) {
        if (afterIds.has(item.identity)) {
          continue;
        }
        const node = this.nodeById.get(item.nodeId);
        if (node?.status) {
          events.push({ identity: item.identity, index: item.index, target: { node } });
        }
      }
      this.events.set(
        ownerId,
        events.sort((a, b) => a.index - b.index)
      );
    }
  }

  /** A layout's children by array index, with the identity used to tell whether two indexes hold the same item. */
  private children(container: WalkedContainer, side: Side) {
    if (isPanelLayoutKind(container.kind)) {
      return container.placements
        .map((p) => ({ identity: `panel:${p.elementName}`, nodeId: this.panelId(p.elementName), index: p.index }))
        .sort((a, b) => a.index - b.index);
    }
    return container.sections.map((s) => {
      const id = this.sectionId(side, s.path);
      return { identity: id, nodeId: id, index: s.index };
    });
  }

  private resolve(path: string[]): ClaimTarget | undefined {
    if (path[0] === 'elements' && path.length === 2) {
      return this.resolveElement(unescapeSegment(path[1]));
    }
    if (path[0] !== 'layout') {
      return undefined;
    }
    return this.resolveContainer(DASHBOARD_NODE_ID, this.walked.baseline.root, this.walked.payload.root, path, 1);
  }

  private resolveElement(name: string): ClaimTarget {
    const node = this.nodeById.get(this.panelId(name))!;
    if (node.status) {
      return { node };
    }
    // Deleted along with a removed section: the section's removal accounts for it.
    let parent = node.parentId ? this.nodeById.get(node.parentId) : undefined;
    while (parent && !parent.status && parent.parentId) {
      parent = this.nodeById.get(parent.parentId);
    }
    return { node: parent?.status ? parent : node };
  }

  private resolveContainer(
    ownerId: string,
    before: WalkedContainer,
    after: WalkedContainer,
    path: string[],
    offset: number
  ): ClaimTarget {
    const restructure = this.change(ownerId, 'layoutType');
    if (restructure) {
      return { change: restructure };
    }
    if (path[offset] !== 'spec' || path.length <= offset + 1) {
      return this.fallback(ownerId);
    }
    const key = path[offset + 1];
    if (key !== childArrayKey(after.kind)) {
      const setting = this.change(ownerId, 'layoutSettings', unescapeSegment(key));
      return setting ? { change: setting } : this.fallback(ownerId);
    }
    if (path.length <= offset + 2) {
      return this.nearestEvent(ownerId, -1) ?? this.fallback(ownerId);
    }
    const index = Number(path[offset + 2]);
    const rest = path.slice(offset + 3);

    if (isPanelLayoutKind(after.kind)) {
      const a = before.placements.find((p) => p.index === index);
      const b = after.placements.find((p) => p.index === index);
      if (a && b && a.elementName === b.elementName && rest.length > 0) {
        return this.resolvePanelItem(ownerId, b, index, rest);
      }
      // A shifted item's width landing on a resized panel's slot reads best as part of that resize.
      const field = rest[0] === 'spec' ? PANEL_ITEM_FIELDS.get(rest[1]) : undefined;
      const own = field && b ? this.change(this.panelId(b.elementName), field) : undefined;
      if (own) {
        return { change: own };
      }
      return this.misaligned(ownerId, index, a && `panel:${a.elementName}`, b && `panel:${b.elementName}`);
    }

    const a = before.sections.find((s) => s.index === index);
    const b = after.sections.find((s) => s.index === index);
    const aId = a && this.sectionId('baseline', a.path);
    const bId = b && this.sectionId('payload', b.path);
    if (a && b && aId === bId && rest.length > 0) {
      return this.resolveSection(ownerId, a, b, index, path, offset + 3);
    }
    return this.misaligned(ownerId, index, aId, bId);
  }

  private resolvePanelItem(ownerId: string, placement: WalkedPlacement, index: number, rest: string[]): ClaimTarget {
    const field = rest[0] === 'spec' ? PANEL_ITEM_FIELDS.get(rest[1]) : undefined;
    const change = field && this.change(this.panelId(placement.elementName), field);
    if (change) {
      return { change };
    }
    if (field === 'position') {
      const node = this.nodeById.get(this.panelId(placement.elementName));
      if (node?.status === 'moved') {
        return { node };
      }
      return this.nearestEvent(ownerId, index) ?? this.fallback(ownerId);
    }
    return this.fallback(ownerId);
  }

  private resolveSection(
    ownerId: string,
    before: WalkedSection,
    after: WalkedSection,
    index: number,
    path: string[],
    offset: number
  ): ClaimTarget {
    const nodeId = this.sectionId('payload', after.path);
    if (path[offset] !== 'spec') {
      return this.fallback(nodeId);
    }
    const key = path[offset + 1];
    if (key === 'layout') {
      return this.resolveContainer(nodeId, before.container, after.container, path, offset + 2);
    }
    const field = SECTION_FIELDS.find((f) => f.field === key)?.field;
    const change = field && this.change(nodeId, field);
    return change ? { change } : this.fallback(nodeId);
  }

  private misaligned(ownerId: string, index: number, beforeId?: string, afterId?: string): ClaimTarget {
    const events = this.events.get(ownerId) ?? [];
    const own =
      events.find((event) => event.identity === afterId && afterId !== undefined) ??
      events.find((event) => event.identity === beforeId && beforeId !== undefined);
    return own?.target ?? this.nearestEvent(ownerId, index) ?? this.fallback(ownerId);
  }

  /** The last event at or before the index, else the first one. */
  private nearestEvent(ownerId: string, index: number): ClaimTarget | undefined {
    const events = this.events.get(ownerId) ?? [];
    const before = events.filter((event) => event.index <= index);
    return (before[before.length - 1] ?? events[0])?.target;
  }

  /** Last resort, so a layout difference no rule explains still shows up instead of being dropped. */
  private fallback(ownerId: string): ClaimTarget {
    let change = this.fallbackByOwner.get(ownerId);
    if (!change) {
      change = {
        nodeId: ownerId,
        category: 'other',
        field: 'layoutSettings',
        kind: 'changed',
        claims: [],
        text: t('dashboard-scene.review.structure.layout-other', 'Layout: changed'),
      };
      this.fallbackByOwner.set(ownerId, change);
      this.changes.push(change);
    }
    return { change };
  }

  // Ordering

  /** The dashboard, then sections and panels depth first in payload reading order, removed items at their baseline position. */
  private orderNodes(): StructureNode[] {
    const ordered: StructureNode[] = [this.nodeById.get(DASHBOARD_NODE_ID)!];
    const seen = new Set<string>([DASHBOARD_NODE_ID]);

    const payloadChildren = (ownerId: string): string[] => {
      const container =
        ownerId === DASHBOARD_NODE_ID
          ? this.walked.payload.root
          : ownerId.startsWith('section:')
            ? this.walked.payload.sectionByPath.get(ownerId.slice('section:'.length))?.container
            : undefined;
      return container ? this.readingOrder(container, 'payload') : [];
    };
    const baselineChildren = (ownerId: string): string[] => {
      let container: WalkedContainer | undefined;
      if (ownerId === DASHBOARD_NODE_ID) {
        container = this.walked.baseline.root;
      } else if (ownerId.startsWith('section-removed:')) {
        container = this.walked.baseline.sectionByPath.get(ownerId.slice('section-removed:'.length))?.container;
      } else {
        const baselinePath = this.matching.payloadToBaseline.get(ownerId.slice('section:'.length));
        container =
          baselinePath !== undefined ? this.walked.baseline.sectionByPath.get(baselinePath)?.container : undefined;
      }
      return container ? this.readingOrder(container, 'baseline') : [];
    };

    const visit = (ownerId: string) => {
      const ids = mergeRemoved(
        payloadChildren(ownerId),
        baselineChildren(ownerId).filter((id) => this.nodeById.get(id)?.parentId === parentKey(ownerId))
      );
      for (const id of ids) {
        const node = this.nodeById.get(id);
        if (!node || seen.has(id)) {
          continue;
        }
        seen.add(id);
        ordered.push(node);
        if (node.kind === 'section') {
          visit(id);
        }
      }
    };
    visit(DASHBOARD_NODE_ID);

    for (const node of this.nodeById.values()) {
      if (!seen.has(node.id)) {
        ordered.push(node);
      }
    }
    return ordered;
  }

  private readingOrder(container: WalkedContainer, side: Side): string[] {
    return isPanelLayoutKind(container.kind)
      ? container.placements.map((p) => this.panelId(p.elementName))
      : container.sections.map((s) => this.sectionId(side, s.path));
  }
}

function parentKey(ownerId: string): string | undefined {
  return ownerId === DASHBOARD_NODE_ID ? undefined : ownerId;
}

/** Payload order, with each baseline-only id placed right after the nearest baseline sibling that survives. */
function mergeRemoved(payloadIds: string[], baselineIds: string[]): string[] {
  const result = [...payloadIds];
  const present = new Set(payloadIds);
  let insertAt = 0;
  for (const id of baselineIds) {
    if (present.has(id)) {
      insertAt = result.indexOf(id) + 1;
      continue;
    }
    result.splice(insertAt, 0, id);
    insertAt++;
  }
  return result;
}

function topLevel(): string {
  return t('dashboard-scene.review.status.top-level', 'the top level of the dashboard');
}

function layoutKindName(kind: LayoutKindName): string {
  switch (kind) {
    case 'GridLayout':
      return t('dashboard-scene.review.structure.layout-kind.grid', 'custom grid');
    case 'AutoGridLayout':
      return t('dashboard-scene.review.structure.layout-kind.auto-grid', 'auto grid');
    case 'RowsLayout':
      return t('dashboard-scene.review.structure.layout-kind.rows', 'rows');
    case 'TabsLayout':
      return t('dashboard-scene.review.structure.layout-kind.tabs', 'tabs');
    default:
      // A kind this version doesn't know (a newer schema): name it from the kind itself.
      return t('dashboard-scene.review.structure.layout-kind.unknown', '{{kind}}', {
        kind: humanizeKind(String(kind ?? '')),
        interpolation: noEscape,
      });
  }
}

/** `FancyLayout` → `Fancy layout`, `FreeFormLayout` → `Free form layout`. */
function humanizeKind(kind: string): string {
  const words = kind
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  if (!words.length) {
    return kind;
  }
  return [words[0].charAt(0).toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ');
}

function kindOf(before: unknown, after: unknown): ChangeKind {
  if (before === undefined) {
    return 'added';
  }
  if (after === undefined) {
    return 'removed';
  }
  return 'changed';
}

function itemValue(placement: WalkedPlacement, field: 'repeat' | 'conditionalRendering' | 'fitContent'): unknown {
  if (field === 'repeat') {
    return placement.item.repeat;
  }
  return placement.layoutKind === 'AutoGridLayout' ? placement.item[field] : undefined;
}

function ownValue(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function changeKey(nodeId: string, field: StructureFieldKey, setting = ''): string {
  return `${nodeId}\u0000${field}\u0000${setting}`;
}
