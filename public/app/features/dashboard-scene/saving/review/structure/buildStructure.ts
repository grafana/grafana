import { isEqual } from 'lodash';

import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type Diff } from '../../../settings/version-history/utils';
import { unescapeSegment } from '../describe/paths';
import { humanizeKey, joinPath, noEscape, rich } from '../richText';
import {
  AUTO_GRID_SETTINGS,
  type ChangeKind,
  DASHBOARD_NODE_ID,
  type MovedInEntry,
  panelNodeId,
  type PathKey,
  pathKey,
  type RawChange,
  type ReviewCategory,
  type RichText,
  type Structure,
  type StructureFieldKey,
  type StructureNode,
} from '../types';

import {
  childArrayKey,
  isPanelLayoutKind,
  nameSide,
  type SideNames,
  type WalkedContainer,
  type WalkedLayout,
  type WalkedPlacement,
  type WalkedSection,
  walkLayout,
} from './layout';
import { longestCommonSubsequence, matchSections, type SectionMatching } from './matching';

type Side = 'baseline' | 'payload';

/** Who a diff path is attributed to: a node's status, or one of the RawChanges. */
type ClaimTarget = { node: StructureNode } | { change: RawChange };

/** What a panel or section node id stands for: an element, or a section on the side the id was made from. */
type NodeRef = { elementName: string } | { side: Side; section: WalkedSection };

/** A layout owner that exists on both sides, with its layout on each. */
interface OwnerPair {
  ownerId: string;
  before: WalkedContainer;
  after: WalkedContainer;
}

/**
 * A structural event in one layout array (an item entering, leaving or changing order), which index-shift
 * noise in that array is attributed to.
 */
interface ArrayEvent {
  nodeId: string;
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
  private refs = new Map<string, NodeRef>();
  private ownerPairs: OwnerPair[] = [];

  constructor(
    private baseline: DashboardV2Spec,
    private payload: DashboardV2Spec,
    private walked: Record<Side, WalkedLayout>,
    private matching: SectionMatching,
    private names: Record<Side, SideNames>
  ) {}

  build(layoutDiffs: Diff[]): Structure {
    this.indexRefs();
    this.ownerPairs = this.matchedOwners().map((ownerId) => {
      const [before, after] = this.containerPair(ownerId)!;
      return { ownerId, before, after };
    });
    this.findMoves();
    this.createNodes();
    this.findChanges();
    this.findEvents();
    const claimed = new Set<PathKey>();
    for (const diff of layoutDiffs) {
      const target = this.resolve(diff.path);
      const key = pathKey(diff.path);
      // The same path always resolves to the same target, so one set tells whether that target has it already.
      if (target && !claimed.has(key)) {
        claimed.add(key);
        ('node' in target ? target.node.claims : target.change.claims).push(key);
      }
    }

    const nodes = this.orderNodes();
    const order = new Map(nodes.map((node, index) => [node.id, index]));
    const changes = [...this.changes].sort((a, b) => (order.get(a.nodeId) ?? 0) - (order.get(b.nodeId) ?? 0));
    return { nodes, changes };
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
    return panelNodeId(elementName);
  }

  /** Records what every panel and section id stands for, so ids are never parsed. */
  private indexRefs() {
    for (const side of ['payload', 'baseline'] as const) {
      for (const section of this.walked[side].sections) {
        const id = this.sectionId(side, section.path);
        // A matched baseline section has its payload id, already recorded with the payload section.
        if (!this.refs.has(id)) {
          this.refs.set(id, { side, section });
        }
      }
      const elements = [...Object.keys(this[side].elements ?? {}), ...this.walked[side].placementByElement.keys()];
      for (const elementName of elements) {
        this.refs.set(this.panelId(elementName), { elementName });
      }
    }
  }

  /** The element a panel id stands for. */
  private elementOf(id: string): string | undefined {
    const ref = this.refs.get(id);
    return ref && 'elementName' in ref ? ref.elementName : undefined;
  }

  /** The section a section id stands for, when made from that side: `section:` payload, `section-removed:` baseline. */
  private sectionOf(id: string, side: Side): WalkedSection | undefined {
    const ref = this.refs.get(id);
    return ref && 'section' in ref && ref.side === side ? ref.section : undefined;
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
      claims: [],
    });

    for (const section of this.walked.payload.sections) {
      const id = this.sectionId('payload', section.path);
      const matched = this.matching.payloadToBaseline.has(section.path);
      this.addNode(
        this.sectionNode(
          'payload',
          section,
          matched ? this.moveStatus(id) : { status: 'added', ...this.movedIn(section) }
        )
      );
    }

    for (const section of this.walked.baseline.sections) {
      if (this.matching.baselineToPayload.has(section.path)) {
        continue;
      }
      const parentRemoved =
        section.parentPath !== undefined && !this.matching.baselineToPayload.has(section.parentPath);
      this.addNode(
        this.sectionNode(
          'baseline',
          section,
          parentRemoved ? {} : { status: 'removed', removedContents: this.removedContents(section) }
        )
      );
    }

    const baselineElements = this.baseline.elements ?? {};
    const payloadElements = this.payload.elements ?? {};
    for (const name of Object.keys(payloadElements)) {
      const existed = Object.hasOwn(baselineElements, name);
      this.addNode(
        this.panelNode('payload', name, existed ? this.moveStatus(this.panelId(name)) : { status: 'added' })
      );
    }

    for (const name of Object.keys(baselineElements)) {
      if (Object.hasOwn(payloadElements, name)) {
        continue;
      }
      const node = this.panelNode('baseline', name, {});
      // Deleted along with a removed section: listed in that section's removedContents instead.
      if (node.parentId === undefined || !this.sectionOf(node.parentId, 'baseline')) {
        node.status = 'removed';
      }
      this.addNode(node);
    }
  }

  /** A row or tab's node, named on its own side; `status` and what goes with it come from the caller. */
  private sectionNode(side: Side, section: WalkedSection, status: Partial<StructureNode>): StructureNode {
    const id = this.sectionId(side, section.path);
    return {
      id,
      kind: 'section',
      sectionKind: section.kind,
      name: side === 'payload' ? this.payloadLabel(id) : this.names.baseline.segments.get(section.path)!.label,
      itemPath: section.path,
      ...this.parentPathOf(side, section.parentPath),
      parentId: this.parentOf(side, section.parentPath),
      ...status,
      claims: [],
    };
  }

  /** A panel's node, named and placed on its own side; `status` and what goes with it come from the caller. */
  private panelNode(side: Side, name: string, status: Partial<StructureNode>): StructureNode {
    const id = this.panelId(name);
    const placement = this.walked[side].placementByElement.get(name);
    return {
      id,
      kind: 'panel',
      elementName: name,
      name: side === 'payload' ? this.payloadLabel(id) : this.names.baseline.panels.get(name)!.label,
      ...(placement ? { itemPath: placement.path } : {}),
      ...this.parentPathOf(side, placement?.sectionPath),
      ownerLabel: this.names[side].owners.get(name),
      parentId: this.parentOf(side, placement?.sectionPath),
      ...status,
      claims: [],
    };
  }

  /**
   * A payload node's own name. A moved node whose name is ambiguous drops its position: describe/ appends its
   * new position to the move text instead.
   */
  private payloadLabel(nodeId: string): RichText {
    const own = this.payloadName(nodeId)!;
    return this.moves.has(nodeId) ? own.name : own.label;
  }

  /** The full path of the section a node sits in, if any. */
  private parentPathOf(side: Side, sectionPath: PathKey | undefined): Pick<StructureNode, 'parentPath'> {
    return sectionPath === undefined ? {} : { parentPath: this.names[side].sections.get(sectionPath)! };
  }

  private addNode(node: StructureNode) {
    this.nodeById.set(node.id, node);
  }

  /**
   * Panels and sections that already existed and sit directly in an added section, in payload reading order,
   * without a move of their own: a restructure put them there (e.g. grouping a grid into rows), so nothing else
   * says where they went. Real moves keep their own node and move text.
   */
  private movedIn(section: WalkedSection): { movedIn: MovedInEntry[] } {
    const baselineElements = this.baseline.elements ?? {};
    const existed = (id: string) => {
      const element = this.elementOf(id);
      return element !== undefined ? Object.hasOwn(baselineElements, element) : this.isMatchedSectionId(id);
    };
    const ids = this.readingOrder(section.container, 'payload').filter((id) => existed(id) && !this.moves.has(id));
    return { movedIn: ids.map((nodeId) => ({ name: this.payloadName(nodeId)!.label, nodeId })) };
  }

  /** Panels deleted with a removed section and its nested sections, in baseline reading order. */
  private removedContents(section: WalkedSection): RichText[] {
    const payloadElements = this.payload.elements ?? {};
    const contents: RichText[] = [];
    // Listed under the removed section's header, so nested sections are named relative to it.
    const visit = (container: WalkedContainer, prefix?: RichText) => {
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
    const section = this.sectionOf(id, 'payload');
    return section !== undefined && this.matching.payloadToBaseline.has(section.path);
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

    for (const { before, after } of this.ownerPairs) {
      if (isPanelLayoutKind(before.kind) !== isPanelLayoutKind(after.kind)) {
        continue;
      }
      const beforeIds = this.readingOrder(before, 'baseline');
      const afterIds = this.readingOrder(after, 'payload');
      const beforeSet = new Set(beforeIds);
      const afterSet = new Set(afterIds);
      const beforeCommon = beforeIds.filter((id) => afterSet.has(id));
      const afterCommon = afterIds.filter((id) => beforeSet.has(id));
      if (isEqual(beforeCommon, afterCommon)) {
        continue;
      }
      const beforeById = this.placementsById(before);
      const afterById = this.placementsById(after);
      const stable = (id: string) => coordinatesUnchanged(beforeById.get(id), afterById.get(id));
      const kept = new Set(longestCommonSubsequence(beforeCommon, afterCommon, stable));
      for (const id of afterCommon) {
        if (!kept.has(id)) {
          this.moves.set(id, { sameSection: true });
        }
      }
    }
  }

  /** A layout's placements by panel node id, the first one for an element placed twice. */
  private placementsById(container: WalkedContainer): Map<string, WalkedPlacement> {
    const byId = new Map<string, WalkedPlacement>();
    for (const placement of container.placements) {
      const id = this.panelId(placement.elementName);
      if (!byId.has(id)) {
        byId.set(id, placement);
      }
    }
    return byId;
  }

  /**
   * A moved node's status: the move text, and its new position when its name is ambiguous (its header then
   * shows the name only). describe/ composes the final statusText from both.
   */
  private moveStatus(nodeId: string): Pick<StructureNode, 'status' | 'move' | 'movedFromId'> {
    const move = this.moves.get(nodeId);
    if (!move) {
      return {};
    }
    const own = this.payloadName(nodeId);
    const from = move.sameSection ? undefined : move.fromSectionPath;
    return {
      status: 'moved',
      move: {
        text: this.moveRelation(nodeId, move),
        ...(own?.ambiguous ? { position: own.position } : {}),
      },
      ...(from !== undefined ? { movedFromId: this.sectionId('baseline', from) } : {}),
    };
  }

  /** Where a moved node is now, relative to its neighbour among its new siblings, and where it came from. */
  private moveRelation(
    nodeId: string,
    move: { sameSection: true } | { sameSection: false; fromSectionPath?: PathKey }
  ): RichText {
    const siblings = this.payloadSiblings(nodeId);
    const index = siblings.indexOf(nodeId);
    const previous = index > 0 ? this.neighbourName(siblings[index - 1]) : undefined;
    const next = index >= 0 && index < siblings.length - 1 ? this.neighbourName(siblings[index + 1]) : undefined;

    if (move.sameSection) {
      return previous !== undefined
        ? rich({ node: previous }, (p) =>
            t('dashboard-scene.review.status.moved-after', 'moved after {{node}}', { ...p, interpolation: noEscape })
          )
        : rich({ node: next ?? [] }, (p) =>
            t('dashboard-scene.review.status.moved-before', 'moved before {{node}}', { ...p, interpolation: noEscape })
          );
    }

    const source = this.sourceLabel(move.fromSectionPath);
    const destination = this.destinationLabel(nodeId);
    if (previous !== undefined) {
      return rich({ source, destination, node: previous }, (p) =>
        t(
          'dashboard-scene.review.status.moved-between-after',
          'moved from {{source}} to {{destination}}, after {{node}}',
          { ...p, interpolation: noEscape }
        )
      );
    }
    if (next !== undefined) {
      return rich({ source, destination, node: next }, (p) =>
        t(
          'dashboard-scene.review.status.moved-between-before',
          'moved from {{source}} to {{destination}}, before {{node}}',
          { ...p, interpolation: noEscape }
        )
      );
    }
    return rich({ source, destination }, (p) =>
      t('dashboard-scene.review.status.moved-between', 'moved from {{source}} to {{destination}}', {
        ...p,
        interpolation: noEscape,
      })
    );
  }

  /** The new section's full path, or the top level for the root. */
  private destinationLabel(nodeId: string): RichText {
    const element = this.elementOf(nodeId);
    const sectionPath =
      element !== undefined
        ? this.walked.payload.placementByElement.get(element)?.sectionPath
        : this.sectionOf(nodeId, 'payload')?.parentPath;
    return sectionPath === undefined ? [topLevel()] : this.names.payload.sections.get(sectionPath)!;
  }

  /** The old section's full path: its current name when it still exists, its baseline name when removed. */
  private sourceLabel(sectionPath: PathKey | undefined): RichText {
    if (sectionPath === undefined) {
      return [topLevel()];
    }
    const payloadPath = this.matching.baselineToPayload.get(sectionPath);
    return payloadPath !== undefined
      ? this.names.payload.sections.get(payloadPath)!
      : this.names.baseline.sections.get(sectionPath)!;
  }

  /** Payload ids of the node's siblings (its new section's children), in reading order. */
  private payloadSiblings(nodeId: string): string[] {
    let container: WalkedContainer | undefined;
    const element = this.elementOf(nodeId);
    if (element !== undefined) {
      const placement = this.walked.payload.placementByElement.get(element);
      container = placement && this.payloadContainerOf(placement.sectionPath);
    } else {
      const section = this.sectionOf(nodeId, 'payload');
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
  private neighbourName(id: string): RichText {
    return this.payloadName(id)?.name ?? [];
  }

  /** The moved node's own name among its new siblings. */
  private payloadName(id: string) {
    const element = this.elementOf(id);
    if (element !== undefined) {
      return this.names.payload.panels.get(element);
    }
    const section = this.sectionOf(id, 'payload');
    return section && this.names.payload.segments.get(section.path);
  }

  /** Baseline and payload layouts of an owner that exists on both sides. */
  private containerPair(ownerId: string): [WalkedContainer, WalkedContainer] | undefined {
    if (ownerId === DASHBOARD_NODE_ID) {
      return [this.walked.baseline.root, this.walked.payload.root];
    }
    const section = this.sectionOf(ownerId, 'payload');
    const baselinePath = section && this.matching.payloadToBaseline.get(section.path);
    if (!section || baselinePath === undefined) {
      return undefined;
    }
    return [this.walked.baseline.sectionByPath.get(baselinePath)!.container, section.container];
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

  /** `subField` tells apart the several layoutSettings changes of one layout. */
  private addChange(change: Omit<RawChange, 'claims' | 'kind'> & { kind?: ChangeKind }): RawChange {
    const full: RawChange = { kind: kindOf(change.before, change.after), ...change, claims: [] };
    this.changes.push(full);
    this.changeByKey.set(changeKey(full.nodeId, full.field, full.subField), full);
    return full;
  }

  private change(nodeId: string, field: StructureFieldKey, setting?: string): RawChange | undefined {
    return this.changeByKey.get(changeKey(nodeId, field, setting));
  }

  private findChanges() {
    for (const { ownerId, before, after } of this.ownerPairs) {
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

    for (const { ownerId, before, after } of this.ownerPairs) {
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
    // In the order the layout options list them, unknown settings last: describe/ keeps this order.
    const keys = [...new Set([...Object.keys(beforeSettings), ...Object.keys(afterSettings)])].sort(
      (a, b) => settingRank(a) - settingRank(b) || (a < b ? -1 : a > b ? 1 : 0)
    );
    for (const key of keys) {
      const beforeValue = ownValue(beforeSettings, key);
      const afterValue = ownValue(afterSettings, key);
      if (!isEqual(beforeValue, afterValue)) {
        this.addChange({
          nodeId: ownerId,
          category: 'layout',
          field: 'layoutSettings',
          subField: key,
          before: beforeValue,
          after: afterValue,
        });
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
    for (const { ownerId, before, after } of this.ownerPairs) {
      if (before.kind !== after.kind) {
        continue;
      }
      const events: ArrayEvent[] = [];
      const beforeItems = this.children(before, 'baseline');
      const afterItems = this.children(after, 'payload');
      const beforeIds = new Set(beforeItems.map((item) => item.nodeId));
      const afterIds = new Set(afterItems.map((item) => item.nodeId));

      for (const item of afterItems) {
        const node = this.nodeById.get(item.nodeId);
        if (!beforeIds.has(item.nodeId)) {
          if (node?.status) {
            events.push({ nodeId: item.nodeId, index: item.index, target: { node } });
          }
          continue;
        }
        const movedNode = this.moves.has(item.nodeId) ? node : undefined;
        if (movedNode) {
          events.push({ nodeId: item.nodeId, index: item.index, target: { node: movedNode } });
          continue;
        }
        const own = this.change(item.nodeId, 'position') ?? this.change(item.nodeId, 'size');
        if (own) {
          events.push({ nodeId: item.nodeId, index: item.index, target: { change: own } });
        }
      }
      for (const item of beforeItems) {
        if (afterIds.has(item.nodeId)) {
          continue;
        }
        const node = this.nodeById.get(item.nodeId);
        if (node?.status) {
          events.push({ nodeId: item.nodeId, index: item.index, target: { node } });
        }
      }
      this.events.set(
        ownerId,
        events.sort((a, b) => a.index - b.index)
      );
    }
  }

  /** A layout's children by array index, with the node id that tells whether two indexes hold the same item. */
  private children(container: WalkedContainer, side: Side) {
    if (isPanelLayoutKind(container.kind)) {
      return container.placements
        .map((p) => ({ nodeId: this.panelId(p.elementName), index: p.index }))
        .sort((a, b) => a.index - b.index);
    }
    return container.sections.map((s) => ({ nodeId: this.sectionId(side, s.path), index: s.index }));
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
      const a = before.placementByIndex.get(index);
      const b = after.placementByIndex.get(index);
      if (a && b && a.elementName === b.elementName && rest.length > 0) {
        return this.resolvePanelItem(ownerId, b, index, rest);
      }
      // A shifted item's width landing on a resized panel's slot reads best as part of that resize.
      const field = rest[0] === 'spec' ? PANEL_ITEM_FIELDS.get(rest[1]) : undefined;
      const own = field && b ? this.change(this.panelId(b.elementName), field) : undefined;
      if (own) {
        return { change: own };
      }
      return this.misaligned(ownerId, index, a && this.panelId(a.elementName), b && this.panelId(b.elementName));
    }

    const a = before.sectionByIndex.get(index);
    const b = after.sectionByIndex.get(index);
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
      events.find((event) => event.nodeId === afterId && afterId !== undefined) ??
      events.find((event) => event.nodeId === beforeId && beforeId !== undefined);
    return own?.target ?? this.nearestEvent(ownerId, index) ?? this.fallback(ownerId);
  }

  /** The last event at or before the index, else the first one. Events are sorted by index. */
  private nearestEvent(ownerId: string, index: number): ClaimTarget | undefined {
    const events = this.events.get(ownerId) ?? [];
    let low = 0;
    let high = events.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (events[middle].index <= index) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return (events[low - 1] ?? events[0])?.target;
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
        ownerId === DASHBOARD_NODE_ID ? this.walked.payload.root : this.sectionOf(ownerId, 'payload')?.container;
      return container ? this.readingOrder(container, 'payload') : [];
    };
    const baselineChildren = (ownerId: string): string[] => {
      const container =
        ownerId === DASHBOARD_NODE_ID
          ? this.walked.baseline.root
          : (this.sectionOf(ownerId, 'baseline')?.container ?? this.containerPair(ownerId)?.[0]);
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

export function layoutKindName(kind: string): string {
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
        kind: humanizeKey(String(kind ?? '')),
        interpolation: noEscape,
      });
  }
}

/** Grid coordinates of a panel unchanged; always true for items without coordinates. */
function coordinatesUnchanged(a: WalkedPlacement | undefined, b: WalkedPlacement | undefined): boolean {
  if (a?.layoutKind !== 'GridLayout' || b?.layoutKind !== 'GridLayout') {
    return true;
  }
  return a.item.x === b.item.x && a.item.y === b.item.y;
}

function settingRank(key: string): number {
  const order: readonly string[] = AUTO_GRID_SETTINGS;
  const rank = order.indexOf(key);
  return rank === -1 ? order.length : rank;
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
