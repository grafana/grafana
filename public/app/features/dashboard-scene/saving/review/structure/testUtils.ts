import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type Diff } from '../../../settings/version-history/utils';
import { checkCompleteness, formatCompletenessReport, type OwnedClaim } from '../__corpus__/completeness';
import { flatDiff } from '../describe/paths';
import { richToPlain } from '../richText';
import { isStructureDiff } from '../summarizeDashboardChanges';
import { pathKey, type RichText, type Structure, type StructureNode } from '../types';

import { buildStructure } from './buildStructure';

/** The diffs buildStructure is responsible for, as summarizeDashboardChanges hands them to it. */
export function layoutDiffsOf(baseline: DashboardV2Spec, payload: DashboardV2Spec): Diff[] {
  return flatDiff(baseline, payload).filter(isStructureDiff);
}

/**
 * The completeness report of a structure over its diffs: every diff claimed exactly once across node and
 * change claims, and every claim covering at least one diff. Empty when the invariant holds.
 */
export function claimProblems(structure: Structure, diffs: Diff[]): string {
  const claims: OwnedClaim[] = [
    ...structure.nodes.flatMap((node) => node.claims.map((claim) => ({ claim, owner: `node ${node.id}` }))),
    ...structure.changes.flatMap((change) =>
      change.claims.map((claim) => ({ claim, owner: `change ${change.nodeId}/${change.field}` }))
    ),
  ];
  return formatCompletenessReport(
    checkCompleteness(
      diffs.map((diff) => pathKey(diff.path)),
      claims
    )
  );
}

/** Builds the structure and checks the claim invariant, as every structure test should. */
export function structureOf(baseline: DashboardV2Spec, payload: DashboardV2Spec): Structure {
  const diffs = layoutDiffsOf(baseline, payload);
  const structure = buildStructure(baseline, payload, diffs);
  const problems = claimProblems(structure, diffs);
  if (problems) {
    throw new Error(`Claim invariant broken:\n${problems}`);
  }
  return structure;
}

/** Compact view of the nodes for assertions, as the corpus renders headers: "+ label", "- label", "label moved …". */
export function outline(structure: Structure): string[] {
  const depth = new Map<string, number>();
  return structure.nodes.map((node) => {
    const d = node.parentId ? (depth.get(node.parentId) ?? 0) + 1 : 0;
    depth.set(node.id, d);
    const marker = node.status === 'added' ? '+ ' : node.status === 'removed' ? '- ' : '';
    const status = node.move ? ` ${moveStatusText(node)}` : '';
    return `${'  '.repeat(d)}${marker}${plainLabel(node)}${status}`;
  });
}

/**
 * A node's name in plain text, sections with their full path (`Tab "Cluster" › Row "Nodes"`) so a test names
 * a node unambiguously without depending on which ancestors describe/ shows.
 */
function plainLabel(node: StructureNode): string {
  if (node.kind === 'dashboard') {
    return 'Dashboard';
  }
  const name = richToPlain(node.name ?? []);
  return node.kind === 'section' && node.parentPath ? `${richToPlain(node.parentPath)} › ${name}` : name;
}

/**
 * A node with its rich texts as plain strings, for assertions; `label` is `plainLabel`. `move` is flattened into
 * `moveText` and `movePosition`, `movedIn` into its names.
 */
interface PlainNode
  extends Omit<StructureNode, 'name' | 'parentPath' | 'move' | 'ownerLabel' | 'removedContents' | 'movedIn'> {
  label: string;
  name?: string;
  parentPath?: string;
  moveText?: string;
  movePosition?: number;
  ownerLabel?: string;
  removedContents?: string[];
  movedInContents?: string[];
}

function plainNode(node: StructureNode): PlainNode {
  const { name, parentPath, move, ownerLabel, removedContents, movedIn, movedFromId, itemPath, ...rest } = node;
  const plain = (text: RichText | undefined) => (text ? richToPlain(text) : undefined);
  return {
    ...rest,
    label: plainLabel(node),
    ...(name ? { name: plain(name) } : {}),
    ...(parentPath ? { parentPath: plain(parentPath) } : {}),
    ...(move ? { moveText: plain(move.text) } : {}),
    ...(move?.position !== undefined ? { movePosition: move.position } : {}),
    ...(ownerLabel ? { ownerLabel: plain(ownerLabel) } : {}),
    ...(removedContents ? { removedContents: removedContents.map(richToPlain) } : {}),
    ...(movedIn ? { movedInContents: movedIn.map(({ name }) => richToPlain(name)) } : {}),
  };
}

export function plainNodes(structure: Structure): PlainNode[] {
  return structure.nodes.map(plainNode);
}

/** The move part of a header as describe/ composes it: the move text, then the new position when ambiguous. */
export function moveStatusText(node: StructureNode): string {
  const text = richToPlain(node.move?.text ?? []);
  return node.move?.position !== undefined ? `${text}, at position ${node.move.position}` : text;
}

/** Compact view of the changes: "node label: field [kind]" or the change's own text. */
export function changeList(structure: Structure): string[] {
  const label = new Map(structure.nodes.map((node) => [node.id, plainLabel(node)]));
  return structure.changes.map(
    (change) => `${label.get(change.nodeId)}: ${change.text ?? `${change.field} ${change.kind}`}`
  );
}
