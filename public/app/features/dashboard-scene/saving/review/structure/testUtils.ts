import {
  type AutoGridLayoutItemSpec,
  type Spec as DashboardV2Spec,
  defaultSpec,
  type GridLayoutItemKind,
  type RowsLayoutRowSpec,
  type TabsLayoutTabSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type Diff, jsonDiff } from '../../../settings/version-history/utils';
import { claimCovers, pathKey, type Structure, type StructureNode } from '../types';

import { buildStructure } from './buildStructure';
import { type LayoutKind } from './walkLayout';

/** Grid item: [element name, x, y, width?, height?]. */
export type GridItem = [name: string, x: number, y: number, width?: number, height?: number];

export function grid(...items: GridItem[]): LayoutKind {
  return {
    kind: 'GridLayout',
    spec: {
      items: items.map(
        ([name, x, y, width = 12, height = 8]): GridLayoutItemKind => ({
          kind: 'GridLayoutItem',
          spec: { x, y, width, height, element: { kind: 'ElementReference', name } },
        })
      ),
    },
  };
}

export function autoGrid(
  items: Array<string | ({ name: string } & Partial<Omit<AutoGridLayoutItemSpec, 'element'>>)>,
  settings: Partial<Record<string, unknown>> = {}
): LayoutKind {
  return {
    kind: 'AutoGridLayout',
    spec: {
      columnWidthMode: 'standard',
      rowHeightMode: 'standard',
      ...settings,
      items: items.map((item) => {
        const { name, ...rest } = typeof item === 'string' ? { name: item } : item;
        return { kind: 'AutoGridLayoutItem', spec: { element: { kind: 'ElementReference', name }, ...rest } };
      }),
    },
  };
}

export function row(title: string | undefined, layout: LayoutKind, extra: Partial<RowsLayoutRowSpec> = {}) {
  return { kind: 'RowsLayoutRow' as const, spec: { ...(title !== undefined ? { title } : {}), layout, ...extra } };
}

export function tab(title: string | undefined, layout: LayoutKind, extra: Partial<TabsLayoutTabSpec> = {}) {
  return { kind: 'TabsLayoutTab' as const, spec: { ...(title !== undefined ? { title } : {}), layout, ...extra } };
}

export function rows(...children: Array<ReturnType<typeof row>>): LayoutKind {
  return { kind: 'RowsLayout', spec: { rows: children } };
}

export function tabs(...children: Array<ReturnType<typeof tab>>): LayoutKind {
  return { kind: 'TabsLayout', spec: { tabs: children } };
}

/** A dashboard with the given layout and panels (element name → title). */
export function dashboard(layout: LayoutKind, panels: Record<string, string>): DashboardV2Spec {
  const elements: DashboardV2Spec['elements'] = {};
  Object.entries(panels).forEach(([name, title], id) => {
    elements[name] = {
      kind: 'Panel',
      spec: {
        id: id + 1,
        title,
        links: [],
        data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
        vizConfig: {
          kind: 'VizConfig',
          group: 'timeseries',
          version: '',
          spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
        },
      },
    };
  });
  return { ...defaultSpec(), elements, layout };
}

/** The diffs buildStructure is responsible for: everything under `layout`, plus whole-element adds and removes. */
export function layoutDiffsOf(baseline: DashboardV2Spec, payload: DashboardV2Spec): Diff[] {
  return Object.values(jsonDiff(baseline, payload))
    .flat()
    .filter((diff) => diff.path[0] === 'layout' || (diff.path[0] === 'elements' && diff.path.length === 2));
}

/**
 * Every diff is claimed exactly once across node and change claims, and every claim covers at least one diff.
 * Returns the problems found, so a failing test shows them all.
 */
export function claimProblems(structure: Structure, diffs: Diff[]): string[] {
  const claims = [
    ...structure.nodes.flatMap((node) => node.claims.map((claim) => ({ claim, owner: `node ${node.id}` }))),
    ...structure.changes.flatMap((change) =>
      change.claims.map((claim) => ({ claim, owner: `change ${change.nodeId}/${change.field}` }))
    ),
  ];
  const paths = diffs.map((diff) => pathKey(diff.path));
  const problems: string[] = [];
  for (const path of paths) {
    const owners = claims.filter(({ claim }) => claimCovers(claim, path)).map(({ owner }) => owner);
    if (owners.length !== 1) {
      problems.push(`${path}: claimed ${owners.length} times${owners.length ? ` (${owners.join(', ')})` : ''}`);
    }
  }
  for (const { claim, owner } of claims) {
    if (!paths.some((path) => claimCovers(claim, path))) {
      problems.push(`${claim}: phantom claim by ${owner}`);
    }
  }
  return problems;
}

/** Builds the structure and checks the claim invariant, as every structure test should. */
export function structureOf(baseline: DashboardV2Spec, payload: DashboardV2Spec): Structure {
  const diffs = layoutDiffsOf(baseline, payload);
  const structure = buildStructure(baseline, payload, diffs);
  const problems = claimProblems(structure, diffs);
  if (problems.length) {
    throw new Error(`Claim invariant broken:\n${problems.join('\n')}`);
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
    const status = node.moveText ? ` ${moveStatusText(node)}` : '';
    return `${'  '.repeat(d)}${marker}${node.label}${status}`;
  });
}

/** The move part of a header as describe/ composes it: the move text, then the new position when ambiguous. */
export function moveStatusText(node: StructureNode): string {
  return node.movePosition !== undefined ? `${node.moveText}, at position ${node.movePosition}` : (node.moveText ?? '');
}

/** Compact view of the changes: "node label: field [kind]" or the change's own text. */
export function changeList(structure: Structure): string[] {
  const label = new Map(structure.nodes.map((node) => [node.id, node.label]));
  return structure.changes.map(
    (change) => `${label.get(change.nodeId)}: ${change.text ?? `${change.field} ${change.kind}`}`
  );
}
