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
// registration order. Empty until concrete sources exist.
export const KNOWN_SECTION_ORDER: string[] = [];

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
    for (const section of source.providedSections) {
      if (!sections.has(section.id)) {
        sections.set(section.id, section);
      }
      if (state?.loading) {
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

  return orderedIds.map((id) => {
    const section = sections.get(id);
    if (!section) {
      throw new Error(`Unknown cmdk section id: ${id}`);
    }
    const items = [...(itemsBySection.get(id) ?? [])].sort((a, b) => b.priority - a.priority);
    return { section, items, loading: loadingBySection.get(id) ?? false };
  });
}
