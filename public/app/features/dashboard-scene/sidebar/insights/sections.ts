import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';

import { type InsightSourcePanel, type InsightSourceSection } from './sources';

export interface InsightSourcePanelNode {
  kind: 'panel';
  ref: string;
  label: string;
  source: InsightSourcePanel;
}

export interface InsightSourceSectionNode {
  kind: InsightSourceSection['kind'];
  ref: string;
  label: string;
  /** Labels from the outermost section down to this one, such as "LLM usage › Tokens". */
  location: string;
  section: InsightSourceSection;
  children: InsightSourceNode[];
}

export type InsightSourceNode = InsightSourcePanelNode | InsightSourceSectionNode;

const SECTION_PREFIX = 'section:';

/** Tabs and rows have no stable ID in the dashboard model, so a selection stores the titles leading to it. */
export function sectionRef(path: string[]): string {
  return `${SECTION_PREFIX}${JSON.stringify(path)}`;
}

/** Every panel on the dashboard, including panels added later: the section with an empty path. */
export const DASHBOARD_SOURCE_REF = sectionRef([]);

export function getDashboardSourceLabel(): string {
  return t('dashboard.insights.sources.entire-dashboard', 'Entire dashboard');
}

export function parseSectionRef(ref: string): string[] | undefined {
  if (!ref.startsWith(SECTION_PREFIX)) {
    return undefined;
  }
  try {
    const path: unknown = JSON.parse(ref.slice(SECTION_PREFIX.length));
    return Array.isArray(path) && path.every((part) => typeof part === 'string') ? path : undefined;
  } catch {
    return undefined;
  }
}

function untitled(kind: InsightSourceSection['kind']): string {
  return kind === 'tab'
    ? t('dashboard.insights.sources.untitled-tab', 'Untitled tab')
    : t('dashboard.insights.sources.untitled-row', 'Untitled row');
}

export function getSectionLabel(section: InsightSourceSection): string {
  return sceneGraph.interpolate(section.object, section.title).trim() || untitled(section.kind);
}

/** Tabs, rows, and source panels in dashboard order. Sections without source panels are left out. */
export function getInsightSourceTree(sources: InsightSourcePanel[]): InsightSourceNode[] {
  const root: InsightSourceNode[] = [];
  for (const source of sources) {
    let level = root;
    const path: string[] = [];
    const labels: string[] = [];
    for (const section of source.sections) {
      path.push(section.title);
      labels.push(getSectionLabel(section));
      let node = level.find(
        (candidate): candidate is InsightSourceSectionNode =>
          candidate.kind !== 'panel' && candidate.section.object === section.object
      );
      if (!node) {
        node = {
          kind: section.kind,
          ref: sectionRef(path),
          label: labels[labels.length - 1],
          location: labels.join(' › '),
          section,
          children: [],
        };
        level.push(node);
      }
      level = node.children;
    }
    level.push({ kind: 'panel', ref: source.key, label: source.title, source });
  }
  return root;
}

export function getPanelNodes(nodes: InsightSourceNode[]): InsightSourcePanelNode[] {
  return nodes.flatMap((node) => (node.kind === 'panel' ? [node] : getPanelNodes(node.children)));
}

/** Every selectable reference in these nodes and their descendants. */
export function getRefs(nodes: InsightSourceNode[]): string[] {
  return nodes.flatMap((node) => (node.kind === 'panel' ? [node.ref] : [node.ref, ...getRefs(node.children)]));
}

function isInSection(source: InsightSourcePanel, path: string[]): boolean {
  return source.sections.length >= path.length && path.every((title, index) => source.sections[index].title === title);
}

/** Expands tabs and rows into the panels they hold now, so a section picks up panels added later. */
export function resolveInsightSourceKeys(refs: string[], sources: InsightSourcePanel[]): string[] {
  const keys = refs.flatMap((ref) => {
    const path = parseSectionRef(ref);
    return path ? sources.filter((source) => isInSection(source, path)).map((source) => source.key) : [ref];
  });
  return [...new Set(keys)];
}

/** Selected tabs and rows that no longer hold any source panel. */
export function getMissingSectionRefs(refs: string[], sources: InsightSourcePanel[]): string[] {
  return refs.filter((ref) => {
    const path = parseSectionRef(ref);
    return path !== undefined && !sources.some((source) => isInSection(source, path));
  });
}

/** Label for a saved reference that is no longer on the dashboard. */
export function getMissingRefLabel(ref: string): string {
  const path = parseSectionRef(ref);
  if (path?.length === 0) {
    return getDashboardSourceLabel();
  }
  return path ? path.map((title) => title || t('dashboard.insights.sources.untitled', 'Untitled')).join(' › ') : ref;
}

/** Where a panel sits, such as "LLM usage › Tokens", so answers can name the part of the dashboard. */
export function getPanelLocation(source: InsightSourcePanel): string {
  return source.sections.map(getSectionLabel).join(' › ');
}
