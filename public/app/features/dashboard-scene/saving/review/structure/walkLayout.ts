import {
  type AutoGridLayoutItemSpec,
  type Spec as DashboardV2Spec,
  type GridLayoutItemSpec,
  type RowsLayoutRowSpec,
  type TabsLayoutTabSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type PathKey } from '../types';

export type LayoutKindName = DashboardV2Spec['layout']['kind'];
export type LayoutKind = DashboardV2Spec['layout'];
export type SectionKind = 'row' | 'tab';

/** A layout object: the dashboard's root layout or a section's own layout. */
export interface WalkedContainer {
  /** Spec path of the layout object, e.g. `layout` or `layout/spec/rows/1/spec/layout`. */
  path: PathKey;
  kind: LayoutKindName;
  layout: LayoutKind;
  /** Path of the section that owns this layout; undefined for the root layout. */
  sectionPath?: PathKey;
  /** Path of the array holding this layout's children, e.g. `layout/spec/items`. */
  arrayPath: PathKey;
  /** Direct child sections (rows/tabs layouts), in array order. */
  sections: WalkedSection[];
  /** Direct panel placements (grid layouts), in reading order. */
  placements: WalkedPlacement[];
}

export interface WalkedSection {
  /** Spec path of the row or tab, e.g. `layout/spec/rows/1/spec/layout/spec/tabs/0`. */
  path: PathKey;
  kind: SectionKind;
  /** Trimmed title; empty when untitled. */
  title: string;
  spec: RowsLayoutRowSpec | TabsLayoutTabSpec;
  /** Path of the containing section; undefined at the root. */
  parentPath?: PathKey;
  /** Index in the parent's rows/tabs array. */
  index: number;
  container: WalkedContainer;
}

export type WalkedPlacement = PlacedItem & {
  elementName: string;
  /** Path of the containing section; undefined for root-level panels. */
  sectionPath?: PathKey;
  /** Spec path of the layout item, e.g. `layout/spec/items/3`. */
  path: PathKey;
  /** Index in the layout's items array. */
  index: number;
  /** Position in reading order within its layout. */
  order: number;
};

type PlacedItem =
  | { layoutKind: 'GridLayout'; item: GridLayoutItemSpec }
  | { layoutKind: 'AutoGridLayout'; item: AutoGridLayoutItemSpec };

export interface WalkedLayout {
  root: WalkedContainer;
  /** Every section, depth first in reading order. */
  sections: WalkedSection[];
  sectionByPath: Map<PathKey, WalkedSection>;
  /** Every placement, depth first in reading order. */
  placements: WalkedPlacement[];
  /** First placement of each element. */
  placementByElement: Map<string, WalkedPlacement>;
  containerByPath: Map<PathKey, WalkedContainer>;
}

export function isPanelLayoutKind(kind: LayoutKindName): kind is 'GridLayout' | 'AutoGridLayout' {
  return kind === 'GridLayout' || kind === 'AutoGridLayout';
}

/** Walks a v2 layout at any depth, yielding its sections and panel placements in reading order. */
export function walkLayout(layout: LayoutKind | undefined): WalkedLayout {
  const walked: WalkedLayout = {
    root: undefined!,
    sections: [],
    sectionByPath: new Map(),
    placements: [],
    placementByElement: new Map(),
    containerByPath: new Map(),
  };
  walked.root = walkContainer(layout ?? { kind: 'GridLayout', spec: { items: [] } }, 'layout', undefined, walked);
  return walked;
}

function walkContainer(
  layout: LayoutKind,
  path: PathKey,
  sectionPath: PathKey | undefined,
  walked: WalkedLayout
): WalkedContainer {
  const container: WalkedContainer = {
    path,
    kind: layout.kind,
    layout,
    sectionPath,
    arrayPath: `${path}/spec/${childArrayKey(layout.kind)}`,
    sections: [],
    placements: [],
  };
  walked.containerByPath.set(path, container);

  switch (layout.kind) {
    case 'GridLayout': {
      const items = (layout.spec?.items ?? []).map((item, index) => ({ item, index }));
      const sorted = [...items].sort(
        (a, b) => (a.item.spec?.y ?? 0) - (b.item.spec?.y ?? 0) || (a.item.spec?.x ?? 0) - (b.item.spec?.x ?? 0)
      );
      sorted.forEach(({ item, index }, order) => {
        if (item.spec) {
          addPlacement(container, walked, { layoutKind: 'GridLayout', item: item.spec }, index, order);
        }
      });
      break;
    }
    case 'AutoGridLayout': {
      (layout.spec?.items ?? []).forEach((item, index) => {
        if (item.spec) {
          addPlacement(container, walked, { layoutKind: 'AutoGridLayout', item: item.spec }, index, index);
        }
      });
      break;
    }
    case 'RowsLayout':
    case 'TabsLayout': {
      const kind: SectionKind = layout.kind === 'RowsLayout' ? 'row' : 'tab';
      const children: Array<{ spec: RowsLayoutRowSpec | TabsLayoutTabSpec }> =
        layout.kind === 'RowsLayout' ? (layout.spec?.rows ?? []) : (layout.spec?.tabs ?? []);
      children.forEach((child, index) => {
        const sectionPathKey = `${container.arrayPath}/${index}`;
        const spec = child.spec ?? { layout: { kind: 'GridLayout', spec: { items: [] } } };
        const section: WalkedSection = {
          path: sectionPathKey,
          kind,
          title: (spec.title ?? '').trim(),
          spec,
          parentPath: sectionPath,
          index,
          container: undefined!,
        };
        container.sections.push(section);
        walked.sections.push(section);
        walked.sectionByPath.set(sectionPathKey, section);
        section.container = walkContainer(
          spec.layout ?? { kind: 'GridLayout', spec: { items: [] } },
          `${sectionPathKey}/spec/layout`,
          sectionPathKey,
          walked
        );
      });
      break;
    }
  }
  return container;
}

function addPlacement(
  container: WalkedContainer,
  walked: WalkedLayout,
  placed: PlacedItem,
  index: number,
  order: number
) {
  const elementName = placed.item.element?.name;
  if (elementName === undefined) {
    return;
  }
  const placement: WalkedPlacement = {
    ...placed,
    elementName,
    sectionPath: container.sectionPath,
    path: `${container.arrayPath}/${index}`,
    index,
    order,
  };
  container.placements.push(placement);
  walked.placements.push(placement);
  if (!walked.placementByElement.has(elementName)) {
    walked.placementByElement.set(elementName, placement);
  }
}

export function childArrayKey(kind: LayoutKindName): 'items' | 'rows' | 'tabs' {
  switch (kind) {
    case 'RowsLayout':
      return 'rows';
    case 'TabsLayout':
      return 'tabs';
    default:
      return 'items';
  }
}

/** Every element name placed anywhere inside a container. */
export function placedElements(container: WalkedContainer): string[] {
  return [
    ...container.placements.map((placement) => placement.elementName),
    ...container.sections.flatMap((section) => placedElements(section.container)),
  ];
}
