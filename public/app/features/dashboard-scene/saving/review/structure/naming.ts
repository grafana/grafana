import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { joinPath, named, noEscape, rich } from '../richText';
import { type PathKey, type RichText } from '../types';

import { type WalkedLayout, type WalkedSection } from './walkLayout';

/** How one element is named among its siblings. */
export interface ElementName {
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
export function withPosition(name: RichText, position: number): RichText {
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
