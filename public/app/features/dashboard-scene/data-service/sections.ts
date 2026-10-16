import { type DashboardSourceResolution, type DashboardUnavailableSource } from '@grafana/data';

import { type SourcePanel } from './sources';

const SECTION_PREFIX = 'section:';

/** Tabs and rows have no stable ID in the dashboard model, so a reference stores the titles leading to it. */
export function sectionRef(path: string[]): string {
  return `${SECTION_PREFIX}${JSON.stringify(path)}`;
}

/** Every panel on the dashboard, including panels added later: the section with an empty path. */
export const ALL_PANELS_REF = sectionRef([]);

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

function isInSection(source: SourcePanel, path: string[]): boolean {
  return source.sections.length >= path.length && path.every((title, index) => source.sections[index].title === title);
}

/** Expands section references into the panels they hold now, so a section picks up panels added later. Panel keys pass through. */
export function expandSourceRefs(refs: string[], sources: SourcePanel[]): string[] {
  const keys = refs.flatMap((ref) => {
    const path = parseSectionRef(ref);
    return path ? sources.filter((source) => isInSection(source, path)).map((source) => source.key) : [ref];
  });
  return [...new Set(keys)];
}

export function resolveSourceRefs(refs: string[], sources: SourcePanel[]): DashboardSourceResolution {
  const known = new Set(sources.map((source) => source.key));
  const unavailable = refs.flatMap((ref): DashboardUnavailableSource[] => {
    const path = parseSectionRef(ref);
    if (path === undefined) {
      return known.has(ref) ? [] : [{ ref }];
    }
    return sources.some((source) => isInSection(source, path)) ? [] : [{ ref, sectionPath: path }];
  });
  return { panelKeys: expandSourceRefs(refs, sources).filter((key) => known.has(key)), unavailable };
}
