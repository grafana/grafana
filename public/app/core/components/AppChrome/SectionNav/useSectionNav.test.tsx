import { renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { getWrapper } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { configureStore } from 'app/store/configureStore';

import { useSectionNav } from './useSectionNav';

jest.mock('app/core/hooks/useMediaQueryMinWidth');

const mockUseMediaQueryMinWidth = jest.mocked(useMediaQueryMinWidth);

const navTree: NavModelItem[] = [
  {
    id: 'cfg',
    text: 'Administration',
    url: '/admin',
    children: [{ id: 'cfg/access', text: 'Users and access', url: '/admin/access', children: [pageItem('users')] }],
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
  beforeEach(() => {
    mockUseMediaQueryMinWidth.mockReturnValue(true);
  });

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

  it('shows from the URL before the page has told the chrome where it is, with nothing marked', () => {
    const model = render('monitoring', { path: '/monitoring/rules' });

    expect(model?.groups).toHaveLength(1);
    expect(model?.activeId).toBeUndefined();
    expect(render('cfg', { path: '/monitoring/rules' })).toBeUndefined();
  });

  it('shows on the section landing page', () => {
    expect(render('monitoring', { path: '/monitoring' })?.activeId).toBeUndefined();
    expect(render('monitoring', { path: '/monitoring' })).toBeDefined();
  });

  it('leaves out groups with no destinations', () => {
    const model = render('monitoring', { currentPage: pageItem('rules') });

    expect(model?.groups.map((group) => group.id)).not.toContain('monitoring/empty');
  });

  it.each([
    ['it is not enabled', { enabled: false }],
    ['the screen is too narrow', { narrow: true }],
  ])('is not shown when %s', (_name, options) => {
    mockUseMediaQueryMinWidth.mockReturnValue(!('narrow' in options));

    expect(render('monitoring', { enabled: !('enabled' in options), currentPage: pageItem('rules') })).toBeUndefined();
  });
});
