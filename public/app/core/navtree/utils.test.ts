import { type NavModelItem } from '@grafana/data';

import { findNavById, findNavByUrl, moveNavItemToSection } from './utils';

describe('findNavByUrl', () => {
  const tree: NavModelItem[] = [
    { text: 'Home', id: 'home', url: '/' },
    {
      text: 'Section',
      id: 'section',
      children: [
        { text: 'Item', id: 'item', url: '/item' },
        { text: 'Report', id: 'report', url: '/reports/usage?tab=daily' },
      ],
    },
  ];

  it('returns the first item, at any depth, whose url satisfies the match', () => {
    expect(findNavByUrl(tree, (url) => url === '/')?.id).toBe('home');
    expect(findNavByUrl(tree, (url) => url === '/item')?.id).toBe('item');
    expect(findNavByUrl(tree, (url) => url.split('?')[0] === '/reports/usage')?.id).toBe('report');
  });

  it('skips items without a url and returns undefined when nothing matches', () => {
    expect(findNavByUrl(tree, (url) => url === '/no-item')).toBeUndefined();
  });
});

describe('moveNavItemToSection', () => {
  // Apps in a section carry the weight an unplaced app gets, so a moved item
  // ties with them and keeps their order — unless it is given its own weight
  const sectioned = (): NavModelItem[] => [
    { id: 'plugin-page-moving-app', text: 'Moving app', url: '/a/moving-app', sortWeight: -1200 },
    {
      id: 'apps',
      text: 'More apps',
      url: '/apps',
      children: [{ id: 'plugin-page-some-app', text: 'Some app', url: '/a/some-app', sortWeight: -1700 }],
    },
  ];

  it('appends into the section and re-sorts it around the given weight', () => {
    const moved = moveNavItemToSection(sectioned(), 'plugin-page-moving-app', 'apps', -1700);

    expect(moved.map((item) => item.id)).toEqual(['apps']);
    expect((findNavById(moved, 'apps')?.children ?? []).map((child) => child.id)).toEqual([
      'plugin-page-some-app',
      'plugin-page-moving-app',
    ]);
  });

  // The weight it arrived with survives, which is the trap the sortWeight
  // argument exists to avoid: a weight set for the top level means something
  // else inside a section
  it("keeps the item's own weight when none is given", () => {
    const moved = moveNavItemToSection(sectioned(), 'plugin-page-moving-app', 'apps');

    expect(findNavById(moved, 'plugin-page-moving-app')?.sortWeight).toBe(-1200);
  });

  it('leaves the tree alone when either end is missing', () => {
    expect(moveNavItemToSection(sectioned(), 'plugin-page-absent-app', 'apps')).toEqual(sectioned());
    expect(moveNavItemToSection(sectioned(), 'plugin-page-moving-app', 'nonexistent')).toEqual(sectioned());
  });
});
