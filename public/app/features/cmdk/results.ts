import { type CmdkItem, type CmdkSection, type CmdkSource } from './types';

export interface SourceQueryState {
  items: CmdkItem[];
  loading: boolean;
}

export interface CmdkSectionResults {
  section: CmdkSection;
  items: CmdkItem[];
  loading: boolean;
}

// Sections with a known id are always ordered first, in this order. Any other section follows in source
// registration order. Mirrors the priority driven order of the old palette (recent scopes > scopes > recent
// dashboards > actions > pages > preferences).
export const KNOWN_SECTION_ORDER: string[] = [
  'recent-scopes',
  'scopes',
  'recent-dashboards',
  'actions',
  'pages',
  'preferences',
];

/**
 * Groups the per-source query results into ordered sections. Sections come from the sources' providedSections
 * (deduped by id, first registered title wins) so they can be rendered before any results arrive. A section is
 * loading while any source that provides it is still loading. Items referencing a section no source provided get a
 * fallback section appended at the end so they are not silently dropped.
 */
export function buildSectionResults(
  sources: CmdkSource[],
  states: ReadonlyMap<CmdkSource, SourceQueryState>,
  knownSectionOrder: string[] = KNOWN_SECTION_ORDER
): CmdkSectionResults[] {
  const sections = new Map<string, CmdkSection>();
  const loadingBySection = new Map<string, boolean>();
  const itemsBySection = new Map<string, CmdkItem[]>();

  for (const source of sources) {
    const state = states.get(source);
    // A source without a state entry is about to be queried for the first time (the effect starting the query
    // runs one render after the sources change). Treating it as loaded-and-empty would flash the empty state
    // for a frame when navigating subscopes, so treat it as loading.
    const loading = state === undefined || state.loading;
    for (const section of source.providedSections) {
      if (!sections.has(section.id)) {
        sections.set(section.id, section);
      }
      if (loading) {
        loadingBySection.set(section.id, true);
      }
    }
    for (const item of state?.items ?? []) {
      if (!sections.has(item.sectionId)) {
        sections.set(item.sectionId, { id: item.sectionId, title: item.sectionId });
      }
      const items = itemsBySection.get(item.sectionId) ?? [];
      items.push(item);
      itemsBySection.set(item.sectionId, items);
    }
  }

  const orderedIds = [
    ...knownSectionOrder.filter((id) => sections.has(id)),
    ...[...sections.keys()].filter((id) => !knownSectionOrder.includes(id)),
  ];

  return orderedIds
    .map((id) => {
      const section = sections.get(id);
      if (!section) {
        throw new Error(`Unknown cmdk section id: ${id}`);
      }
      const items = [...(itemsBySection.get(id) ?? [])].sort((a, b) => b.priority - a.priority);
      return { section, items, loading: loadingBySection.get(id) ?? false };
    })
    // Empty sections are hidden, but a still-loading section stays visible so its header and spinner can show
    // before the results arrive.
    .filter((sectionResult) => sectionResult.items.length > 0 || sectionResult.loading);
}
