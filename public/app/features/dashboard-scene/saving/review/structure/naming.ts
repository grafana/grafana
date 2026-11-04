import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type PathKey } from '../types';

import { type SectionKind, type WalkedLayout, type WalkedSection } from './walkLayout';

const noEscape = { escapeValue: false };

/** How one element is named among its siblings. */
export interface ElementName {
  /** Type and title only: `Panel "Errors"`, `Row (unnamed)`. */
  name: string;
  /** True when a sibling shares the title (or, untitled, another sibling is untitled too). */
  ambiguous: boolean;
  /** 1-based position in reading order among all siblings in its section. */
  position: number;
  /** The name, plus `at position N` when ambiguous. */
  label: string;
}

export interface SideNames {
  /** Full path label by section path, e.g. `Tab "Cluster" › Row "Backend" at position 2`. */
  sections: Map<PathKey, string>;
  /** A section's own segment among its siblings. */
  segments: Map<PathKey, ElementName>;
  /** By element name, for every element of that side. */
  panels: Map<string, ElementName>;
  /** By element name: the panel label for places with no tree around it (System defaults owners). */
  owners: Map<string, string>;
}

type Element = DashboardV2Spec['elements'][string];

export function panelTitle(element: Element | undefined): string {
  if (!element) {
    return '';
  }
  if (element.kind === 'LibraryPanel') {
    return (element.spec?.title || element.spec?.libraryPanel?.name || '').trim();
  }
  return (element.spec?.title ?? '').trim();
}

/**
 * Names every section and panel of one side the way a person would point at it: type and title, plus its
 * position among its siblings when the title alone doesn't tell it apart.
 */
export function nameSide(walked: WalkedLayout, elements: DashboardV2Spec['elements'] | undefined): SideNames {
  const names: SideNames = { sections: new Map(), segments: new Map(), panels: new Map(), owners: new Map() };

  for (const section of walked.sections) {
    const siblings = siblingsOf(section, walked);
    const segment = nameAmong(
      siblings.map((s) => s.title),
      siblings.indexOf(section),
      (title) => sectionName(section.kind, title)
    );
    names.segments.set(section.path, segment);
    const parentLabel = section.parentPath ? names.sections.get(section.parentPath) : undefined;
    names.sections.set(section.path, parentLabel ? joinPath(parentLabel, segment.label) : segment.label);
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
    const sectionPath = container.sectionPath ? names.sections.get(container.sectionPath) : undefined;
    container.placements.forEach((placement, index) => {
      if (names.panels.has(placement.elementName)) {
        return;
      }
      const panel = nameAmong(titles, index, panelName);
      names.panels.set(placement.elementName, panel);
      const uniqueInDashboard = (dashboardCounts.get(titles[index]) ?? 0) <= 1;
      names.owners.set(
        placement.elementName,
        uniqueInDashboard || !sectionPath
          ? panel.label
          : t('dashboard-scene.review.name.in-section', '{{name}} in {{section}}', {
              name: panel.label,
              section: sectionPath,
              interpolation: noEscape,
            })
      );
    });
  }

  for (const name of Object.keys(allElements)) {
    if (!names.panels.has(name)) {
      const label = panelName(titleOf(name));
      names.panels.set(name, { name: label, ambiguous: false, position: 1, label });
      names.owners.set(name, label);
    }
  }
  return names;
}

/** A segment relative to an ancestor, for entries listed under that ancestor's header. */
export function joinPath(parent: string, child: string): string {
  return t('dashboard-scene.review.name.section-path', '{{parent}} › {{child}}', {
    parent,
    child,
    interpolation: noEscape,
  });
}

/** The name ending with `at position N` (for a moved element, whose header shows the name only). */
export function withPosition(name: string, position: number): string {
  return t('dashboard-scene.review.name.at-position', '{{name}} at position {{position}}', {
    name,
    position,
    interpolation: noEscape,
  });
}

function siblingsOf(section: WalkedSection, walked: WalkedLayout): WalkedSection[] {
  const parent = section.parentPath ? walked.sectionByPath.get(section.parentPath)?.container : walked.root;
  return parent?.sections ?? [section];
}

function nameAmong(titles: string[], index: number, nameOf: (title: string) => string): ElementName {
  const title = titles[index];
  const ambiguous = titles.filter((other) => other === title).length > 1;
  const name = nameOf(title);
  const position = index + 1;
  return { name, ambiguous, position, label: ambiguous ? withPosition(name, position) : name };
}

function sectionName(kind: SectionKind, title: string): string {
  if (!title) {
    return kind === 'row'
      ? t('dashboard-scene.review.name.unnamed-row', 'Row (unnamed)')
      : t('dashboard-scene.review.name.unnamed-tab', 'Tab (unnamed)');
  }
  return kind === 'row'
    ? t('dashboard-scene.review.name.titled-row', 'Row "{{title}}"', { title, interpolation: noEscape })
    : t('dashboard-scene.review.name.titled-tab', 'Tab "{{title}}"', { title, interpolation: noEscape });
}

function panelName(title: string): string {
  return title
    ? t('dashboard-scene.review.name.titled-panel', 'Panel "{{title}}"', { title, interpolation: noEscape })
    : t('dashboard-scene.review.name.unnamed-panel', 'Panel (unnamed)');
}
