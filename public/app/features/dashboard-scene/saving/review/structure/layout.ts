import { t } from '@grafana/i18n';
import {
  type AutoGridLayoutItemSpec,
  type GridLayoutItemSpec,
  type RowsLayoutRowSpec,
  type Spec as DashboardV2Spec,
  type TabsLayoutTabSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { joinPath, named, noEscape, rich } from '../richText';
import { type PathKey, type RichText } from '../types';

// --- Walking the layout ---

type LayoutKindName = DashboardV2Spec['layout']['kind'];
type LayoutKind = DashboardV2Spec['layout'];
type SectionKind = 'row' | 'tab';

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
  sectionByIndex: Map<number, WalkedSection>;
  /** Direct panel placements (grid layouts), in reading order. */
  placements: WalkedPlacement[];
  placementByIndex: Map<number, WalkedPlacement>;
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
    sectionByIndex: new Map(),
    placements: [],
    placementByIndex: new Map(),
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
        container.sectionByIndex.set(index, section);
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
  container.placementByIndex.set(index, placement);
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

// --- Naming ---

/** How one element is named among its siblings. */
interface ElementName {
  /** Kind and title only: `Panel "Errors"`, `Row (unnamed)`. */
  name: RichText;
  /** True when a sibling shares the title (or, untitled, another sibling is untitled too). */
  ambiguous: boolean;
  /** 1-based position in reading order among all siblings in its section. */
  position: number;
  /** The name, plus `at position N` when ambiguous. */
  label: RichText;
}

export interface SideNames {
  /** Full path by section path, e.g. `Tab "Cluster" › Row "Backend" at position 2`. */
  sections: Map<PathKey, RichText>;
  /** A section's own segment among its siblings. */
  segments: Map<PathKey, ElementName>;
  /** By element name, for every element of that side. */
  panels: Map<string, ElementName>;
  /** By element name: the panel label for places with no tree around it (System defaults owners). */
  owners: Map<string, RichText>;
}

type Element = DashboardV2Spec['elements'][string];

function panelTitle(element: Element | undefined): string {
  if (!element) {
    return '';
  }
  if (element.kind === 'LibraryPanel') {
    return (element.spec?.title || element.spec?.libraryPanel?.name || '').trim();
  }
  return (element.spec?.title ?? '').trim();
}

/**
 * Names every section and panel of one side the way a person would point at it: kind and title, plus its
 * position among its siblings when the title alone doesn't tell it apart.
 */
export function nameSide(walked: WalkedLayout, elements: DashboardV2Spec['elements'] | undefined): SideNames {
  const names: SideNames = { sections: new Map(), segments: new Map(), panels: new Map(), owners: new Map() };

  for (const section of walked.sections) {
    const siblings = siblingsOf(section, walked);
    const segment = nameAmong(
      [named(section.kind, section.title)],
      siblings.indexOf(section),
      siblings.filter((s) => s.title === section.title).length
    );
    names.segments.set(section.path, segment);
    const parentPath = section.parentPath ? names.sections.get(section.parentPath) : undefined;
    names.sections.set(section.path, parentPath ? joinPath(parentPath, segment.label) : segment.label);
  }

  const allElements = elements ?? {};
  const titleOf = (name: string) => panelTitle(Object.hasOwn(allElements, name) ? allElements[name] : undefined);
  const dashboardCounts = new Map<string, number>();
  for (const name of Object.keys(allElements)) {
    const title = titleOf(name);
    dashboardCounts.set(title, (dashboardCounts.get(title) ?? 0) + 1);
  }

  for (const container of walked.containerByPath.values()) {
    const titles = container.placements.map((placement) => titleOf(placement.elementName));
    const titleCounts = new Map<string, number>();
    for (const title of titles) {
      titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    }
    const sectionPath = container.sectionPath ? names.sections.get(container.sectionPath) : undefined;
    container.placements.forEach((placement, index) => {
      if (names.panels.has(placement.elementName)) {
        return;
      }
      const panel = nameAmong([named('panel', titles[index])], index, titleCounts.get(titles[index]) ?? 0);
      names.panels.set(placement.elementName, panel);
      const uniqueInDashboard = (dashboardCounts.get(titles[index]) ?? 0) <= 1;
      names.owners.set(
        placement.elementName,
        uniqueInDashboard || !sectionPath
          ? panel.label
          : rich({ name: panel.label, section: sectionPath }, (p) =>
              t('dashboard-scene.review.name.in-section', '{{name}} in {{section}}', { ...p, interpolation: noEscape })
            )
      );
    });
  }

  for (const name of Object.keys(allElements)) {
    if (!names.panels.has(name)) {
      const label = [named('panel', titleOf(name))];
      names.panels.set(name, { name: label, ambiguous: false, position: 1, label });
      names.owners.set(name, label);
    }
  }
  return names;
}

/** The name ending with `at position N`. */
function withPosition(name: RichText, position: number): RichText {
  return rich({ name, position: String(position) }, (p) =>
    t('dashboard-scene.review.name.at-position', '{{name}} at position {{position}}', { ...p, interpolation: noEscape })
  );
}

function siblingsOf(section: WalkedSection, walked: WalkedLayout): WalkedSection[] {
  const parent = section.parentPath ? walked.sectionByPath.get(section.parentPath)?.container : walked.root;
  return parent?.sections ?? [section];
}

function nameAmong(name: RichText, index: number, sameTitleCount: number): ElementName {
  const ambiguous = sameTitleCount > 1;
  const position = index + 1;
  return { name, ambiguous, position, label: ambiguous ? withPosition(name, position) : name };
}
