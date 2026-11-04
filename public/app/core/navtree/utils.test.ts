import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';

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
    const moved = moveNavItemToSection(sectioned(), 'plugin-page-moving-app', 'apps', { sortWeight: -1700 });

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

  it('creates a known target section only when the source item exists', () => {
    const withoutSection = sectioned().slice(0, 1);
    const moved = moveNavItemToSection(withoutSection, 'plugin-page-moving-app', 'apps');

    expect(moved.map((item) => item.id)).toEqual(['apps']);
    expect(findNavById(moved, 'plugin-page-moving-app')).toBeDefined();
    expect(moveNavItemToSection(withoutSection, 'plugin-page-absent-app', 'apps')).toEqual(withoutSection);
  });

  it('leaves the tree alone when the source or target shell is unknown', () => {
    expect(moveNavItemToSection(sectioned(), 'plugin-page-absent-app', 'apps')).toEqual(sectioned());
    expect(moveNavItemToSection(sectioned(), 'plugin-page-moving-app', 'nonexistent')).toEqual(sectioned());
  });
});

describe('moveNavItemToSection with hoisted pages', () => {
  const withApp = (): NavModelItem[] => [
    {
      id: 'plugin-page-grafana-ml-app',
      text: 'Machine Learning',
      url: '/a/grafana-ml-app',
      // The app node carries its plugin id, which is what tells the hoist
      // which children are the app's own pages
      pluginId: 'grafana-ml-app',
      sortWeight: -1200,
      children: [
        { id: 'ml-home', text: 'Home', url: '/a/grafana-ml-app/home' },
        { id: 'ml-models', text: 'Models', url: '/a/grafana-ml-app/models', sortWeight: 2 },
      ],
    },
    {
      id: 'apps',
      text: 'More apps',
      url: '/apps',
      children: [{ id: 'plugin-page-some-app', text: 'Some app', url: '/a/some-app', sortWeight: -1700 }],
    },
  ];

  it('replaces the app with its pages, keyed and weighted as the plugin pass would', () => {
    const hoisted = moveNavItemToSection(withApp(), 'plugin-page-grafana-ml-app', 'apps', { hoistPages: true });

    expect(hoisted.map((item) => item.id)).toEqual(['apps']);
    const children = findNavById(hoisted, 'apps')?.children ?? [];
    // The offset was chosen to clear the small positive weights apps carry in a
    // configured section, so here — where More apps holds apps at NavWeight.plugin
    // — the pages land after them, keeping their own order
    expect(children.map((child) => child.id)).toEqual([
      'plugin-page-some-app',
      'standalone-plugin-page-a-grafana-ml-app-home',
      'standalone-plugin-page-a-grafana-ml-app-models',
    ]);
    expect(children.map((child) => child.sortWeight)).toEqual([-1700, -100, -98]);
  });

  it('keys server-built pages when Grafana is served from a sub-path', () => {
    const originalAppSubUrl = config.appSubUrl;
    config.appSubUrl = '/grafana';
    const tree = withApp();
    const pages = findNavById(tree, 'plugin-page-grafana-ml-app')?.children ?? [];
    for (const page of pages) {
      page.id = undefined;
      page.url = `/grafana${page.url}`;
    }

    try {
      const hoisted = moveNavItemToSection(tree, 'plugin-page-grafana-ml-app', 'apps', { hoistPages: true });

      expect((findNavById(hoisted, 'apps')?.children ?? []).map((child) => child.id)).toEqual([
        'plugin-page-some-app',
        'standalone-plugin-page-a-grafana-ml-app-home',
        'standalone-plugin-page-a-grafana-ml-app-models',
      ]);
    } finally {
      config.appSubUrl = originalAppSubUrl;
    }
  });

  // A dashboard include must not take a standalone id: that would register its
  // /d/<uid> url as an app route and shadow the dashboard
  it('leaves a dashboard child without a standalone id', () => {
    const tree = withApp();
    const app = findNavById(tree, 'plugin-page-grafana-ml-app');
    app?.children?.push({ text: 'Overview dashboard', url: '/d/dash-uid' });

    const hoisted = moveNavItemToSection(tree, 'plugin-page-grafana-ml-app', 'apps', { hoistPages: true });

    const dashboard = (findNavById(hoisted, 'apps')?.children ?? []).find((child) => child.url === '/d/dash-uid');
    expect(dashboard?.id).toBeUndefined();
  });

  it('leaves the tree alone for a missing app or section', () => {
    expect(moveNavItemToSection(withApp(), 'plugin-page-absent-app', 'apps', { hoistPages: true })).toEqual(withApp());
    expect(moveNavItemToSection(withApp(), 'plugin-page-grafana-ml-app', 'nonexistent', { hoistPages: true })).toEqual(
      withApp()
    );
  });

  it('moves the app itself when it has no pages', () => {
    const tree = withApp();
    const app = findNavById(tree, 'plugin-page-grafana-ml-app');
    app!.children = undefined;

    const moved = moveNavItemToSection(tree, 'plugin-page-grafana-ml-app', 'apps', {
      sortWeight: -1700,
      hoistPages: true,
    });

    expect(moved.map((item) => item.id)).toEqual(['apps']);
    expect(findNavById(moved, 'plugin-page-grafana-ml-app')?.sortWeight).toBe(-1700);
  });
});
