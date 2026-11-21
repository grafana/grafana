import { renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { getWrapper } from 'test/test-utils';

import { type GrafanaConfig, locationUtil, type NavModelItem } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';

import { useSectionNav } from './useSectionNav';

let navTree: NavModelItem[] = [
  {
    id: 'cfg',
    text: 'Administration',
    url: '/admin',
    children: [
      {
        id: 'cfg/general',
        text: 'General',
        url: '/admin/general',
        children: [
          { id: 'plugin-page-advisor', text: 'Advisor', url: '/a/grafana-advisor-app/home' },
          // An app's pages arrive without ids of their own
          { text: 'Logs', url: '/a/grafana-dbcfg-app/logs' },
          { text: 'Traces', url: '/a/grafana-dbcfg-app/traces' },
          {
            id: 'provisioning',
            text: 'Provisioning',
            url: '/admin/provisioning',
            children: [{ id: 'provisioning/repos', text: 'Repositories', url: '/admin/provisioning/repos' }],
          },
        ],
      },
      { id: 'cfg/access', text: 'Users and access', url: '/admin/access', children: [pageItem('users')] },
    ],
  },
  {
    id: 'monitoring',
    text: 'Monitoring',
    url: '/monitoring',
    children: [
      { id: 'monitoring/alerts', text: 'Alerts', url: '/monitoring/alerts', children: [pageItem('rules')] },
      { id: 'monitoring/empty', text: 'Nothing here', url: '/monitoring/empty', children: [] },
    ],
  },
];

function pageItem(name: string): NavModelItem {
  const section = name === 'users' ? 'admin' : 'monitoring';
  return { id: name, text: name, url: `/${section}/${name}` };
}

function render(
  sectionId: string,
  { enabled = true, currentPage, path = '/' }: { enabled?: boolean; currentPage?: NavModelItem; path?: string } = {}
) {
  const wrapper = getWrapper({
    store: configureStore({ navBarTree: navTree }),
    renderWithRouter: true,
    historyOptions: { initialEntries: [path] },
  });
  return renderHook(() => useSectionNav(sectionId, enabled, currentPage), {
    wrapper: ({ children }: PropsWithChildren) => wrapper({ children }),
  }).result.current;
}

describe('useSectionNav', () => {
  it('gives the groups of its own section, with the current page marked', () => {
    const model = render('monitoring', { currentPage: pageItem('rules') });

    expect(model?.groups.map((group) => group.id)).toEqual(['monitoring/alerts']);
    expect(model?.activeId).toBe('rules');
  });

  it('is left to the section a page belongs to when there are several', () => {
    const currentPage = pageItem('rules');

    expect(render('monitoring', { currentPage })).toBeDefined();
    expect(render('cfg', { currentPage })).toBeUndefined();
  });

  it('shows from the URL before the page has told the chrome where it is, marking the destination at that URL', () => {
    const model = render('monitoring', { path: '/monitoring/rules' });

    expect(model?.groups).toHaveLength(1);
    expect(model?.activeId).toBe('rules');
    expect(render('cfg', { path: '/monitoring/rules' })).toBeUndefined();
  });

  it('shows on a group landing page before the page has told the chrome where it is', () => {
    const model = render('cfg', { path: '/admin/access' });

    expect(model?.groups.map((group) => group.id)).toEqual(['cfg/general', 'cfg/access']);
    expect(model?.activeId).toBeUndefined();
  });

  it('shows on the section landing page when served from a sub path', () => {
    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });
    const original = navTree;
    navTree = [{ ...original[1], url: '/grafana/monitoring' }];

    try {
      expect(render('monitoring', { path: '/monitoring' })).toBeDefined();
    } finally {
      navTree = original;
      locationUtil.initialize({
        config: { appSubUrl: '' } as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
      });
    }
  });

  it('marks the destination at the URL when the page describes itself with an id of its own', () => {
    const currentPage = { id: 'plugin-own-id', text: 'Rules', url: '/monitoring/rules/extra' };

    expect(render('monitoring', { currentPage, path: '/monitoring/rules/extra' })?.activeId).toBe('rules');
  });

  it('treats every route of a plugin page as that destination', () => {
    const path = '/a/grafana-advisor-app/checks';
    const currentPage = { id: 'checks', text: 'Checks', url: path };

    expect(render('cfg', { path })?.activeId).toBe('plugin-page-advisor');
    expect(render('cfg', { path, currentPage })?.activeId).toBe('plugin-page-advisor');
    expect(render('monitoring', { path })).toBeUndefined();
  });

  it('marks a link without an id by its url, and no other', () => {
    expect(render('cfg', { path: '/a/grafana-dbcfg-app/logs' })?.activeId).toBe('/a/grafana-dbcfg-app/logs');
    expect(render('cfg', { path: '/a/grafana-dbcfg-app/traces' })?.activeId).toBe('/a/grafana-dbcfg-app/traces');
  });

  it('marks none of the pages of an app on its own landing page', () => {
    expect(render('cfg', { path: '/a/grafana-dbcfg-app' })?.activeId).toBeUndefined();
  });

  it('marks the link a nested page belongs to', () => {
    const currentPage = { id: 'provisioning/repos', text: 'Repositories', url: '/admin/provisioning/repos' };

    expect(render('cfg', { currentPage, path: currentPage.url })?.activeId).toBe('provisioning');
    expect(render('cfg', { path: '/admin/provisioning/repos/new' })?.activeId).toBe('provisioning');
  });

  it('shows on the section landing page', () => {
    expect(render('monitoring', { path: '/monitoring' })?.activeId).toBeUndefined();
    expect(render('monitoring', { path: '/monitoring' })).toBeDefined();
  });

  it('leaves out groups with no destinations', () => {
    const model = render('monitoring', { currentPage: pageItem('rules') });

    expect(model?.groups.map((group) => group.id)).not.toContain('monitoring/empty');
  });

  it('is not shown when it is not enabled', () => {
    expect(render('monitoring', { enabled: false, currentPage: pageItem('rules') })).toBeUndefined();
  });
});
