import { buildSectionResults, type SourceQueryState } from './results';
import { type CmdkItem, type CmdkSource } from './types';

function makeItem(id: string, sectionId: string, priority = 0): CmdkItem {
  return { type: 'action', id, sectionId, title: id, priority, action: () => {} };
}

function makeSource(sections: Array<{ id: string; title: string }>): CmdkSource {
  return {
    query: async () => [],
    providedSections: sections,
  };
}

function states(entries: Array<[CmdkSource, SourceQueryState]>): Map<CmdkSource, SourceQueryState> {
  return new Map(entries);
}

describe('buildSectionResults', () => {
  it('shows provided sections even before any items arrive', () => {
    const source = makeSource([{ id: 'nav', title: 'Navigation' }]);
    const result = buildSectionResults([source], states([[source, { items: [], loading: true }]]));

    expect(result).toEqual([{ section: { id: 'nav', title: 'Navigation' }, items: [], loading: true }]);
  });

  it('hides sections that finished loading with no items', () => {
    const source = makeSource([{ id: 'nav', title: 'Navigation' }]);
    const result = buildSectionResults([source], states([[source, { items: [], loading: false }]]));

    expect(result).toEqual([]);
  });

  it('treats a source without a state entry as loading, so sections do not flash out on subscope changes', () => {
    const source = makeSource([{ id: 'nav', title: 'Navigation' }]);
    const result = buildSectionResults([source], states([]));

    expect(result).toEqual([{ section: { id: 'nav', title: 'Navigation' }, items: [], loading: true }]);
  });

  it('merges items from multiple sources into the same section, first registered title wins', () => {
    const sourceA = makeSource([{ id: 'dash', title: 'Dashboards' }]);
    const sourceB = makeSource([{ id: 'dash', title: 'Other title' }]);
    const itemA = makeItem('a', 'dash');
    const itemB = makeItem('b', 'dash');

    const result = buildSectionResults(
      [sourceA, sourceB],
      states([
        [sourceA, { items: [itemA], loading: false }],
        [sourceB, { items: [itemB], loading: false }],
      ])
    );

    expect(result).toHaveLength(1);
    expect(result[0].section.title).toBe('Dashboards');
    expect(result[0].items).toEqual([itemA, itemB]);
  });

  it('sorts items within a section by priority, higher first', () => {
    const source = makeSource([{ id: 'dash', title: 'Dashboards' }]);
    const low = makeItem('low', 'dash', 1);
    const high = makeItem('high', 'dash', 10);

    const result = buildSectionResults([source], states([[source, { items: [low, high], loading: false }]]));

    expect(result[0].items.map((item) => item.id)).toEqual(['high', 'low']);
  });

  it('marks a section as loading while any providing source is loading', () => {
    const sourceA = makeSource([{ id: 'dash', title: 'Dashboards' }]);
    const sourceB = makeSource([{ id: 'dash', title: 'Dashboards' }]);

    const result = buildSectionResults(
      [sourceA, sourceB],
      states([
        [sourceA, { items: [], loading: false }],
        [sourceB, { items: [], loading: true }],
      ])
    );

    expect(result[0].loading).toBe(true);
  });

  it('creates a fallback section for items referencing an unprovided section', () => {
    const source = makeSource([]);
    const item = makeItem('a', 'unknown');

    const result = buildSectionResults([source], states([[source, { items: [item], loading: false }]]));

    expect(result).toEqual([{ section: { id: 'unknown', title: 'unknown' }, items: [item], loading: false }]);
  });

  it('orders known sections first, the rest in registration order', () => {
    const sourceA = makeSource([{ id: 'other', title: 'Other' }]);
    const sourceB = makeSource([{ id: 'nav', title: 'Navigation' }]);

    const result = buildSectionResults(
      [sourceA, sourceB],
      states([
        [sourceA, { items: [makeItem('a', 'other')], loading: false }],
        [sourceB, { items: [makeItem('b', 'nav')], loading: false }],
      ]),
      ['nav']
    );

    expect(result.map((sectionResult) => sectionResult.section.id)).toEqual(['nav', 'other']);
  });
});
