import { render, screen } from 'test/test-utils';

import { type NavIndex } from '@grafana/data';
import { SectionSidebar } from 'app/core/components/AppChrome/SectionSidebar/SectionSidebar';

import { listDashboards, listFolders } from '../api/services';
import { getFolderPermissions } from '../permissions';

import { getDashboardsSectionSidebar } from './dashboardsSectionSidebar';

jest.mock('../api/services', () => ({
  listFolders: jest.fn(),
  listDashboards: jest.fn(),
}));

jest.mock('../api/recentlyViewed', () => ({
  getRecentlyViewedDashboards: jest.fn(async () => [
    { uid: 'r1', name: 'Recent dashboard', url: '/d/r1', location: 'team', kind: 'dashboard' },
  ]),
}));

jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: () => ({
    search: jest.fn(async () => ({
      view: Object.assign([{ kind: 'dashboard', uid: 's1', name: 'CPU usage', url: '/d/s1' }], {
        dataFrame: { meta: {} },
      }),
    })),
  }),
}));

jest.mock('../permissions', () => ({
  getFolderPermissions: jest.fn(),
}));

jest.mock('app/api/clients/folder/v1beta1/hooks', () => ({
  ...jest.requireActual('app/api/clients/folder/v1beta1/hooks'),
  useGetFolderQueryFacade: (uid?: string) => ({ data: uid ? { uid, title: `Folder ${uid}` } : undefined }),
}));

jest.mock('app/features/dashboard/dashgrid/DashboardLibrary/hooks/useTemplateDashboardsAvailability', () => ({
  useTemplateDashboardsAvailability: () => ({ isAvailable: false }),
}));

jest.mock('app/features/stars/hooks', () => ({
  useStarredItems: jest.fn(() => ({ data: [] })),
}));

jest.mock('app/features/search/hooks/useDashboardLocationInfo', () => ({
  useDashboardLocationInfo: () => ({ foldersByUid: { team: { kind: 'folder', name: 'Team folder', url: '' } } }),
}));

const listFoldersMock = jest.mocked(listFolders);
const listDashboardsMock = jest.mocked(listDashboards);

const navIndex: NavIndex = {
  'dashboards/browse': {
    id: 'dashboards/browse',
    text: 'Dashboards',
    url: '/dashboards',
    children: [
      { id: 'dashboards/playlists', text: 'Playlists', url: '/playlists' },
      { id: 'dashboards/snapshots', text: 'Snapshots', url: '/dashboard/snapshots' },
      { id: 'dashboards/library-panels', text: 'Library panels', url: '/library-panels' },
      { id: 'dashboards/public', text: 'Shared dashboards', url: '/dashboard/public' },
    ],
  },
};

function setPermissions({ canCreateDashboards = true, canCreateFolders = true } = {}) {
  jest.mocked(getFolderPermissions).mockReturnValue({
    canCreateDashboards,
    canCreateFolders,
    canDeleteFolders: false,
    canEditDashboards: false,
    canEditFolders: false,
    canSetPermissions: false,
    canViewPermissions: false,
    canDeleteDashboards: false,
  });
}

function renderSidebar(pageContext: Record<string, unknown> = {}) {
  return render(
    <SectionSidebar definition={getDashboardsSectionSidebar()} context={{ sectionId: 'dashboards', pageContext }} />,
    { preloadedState: { navIndex } }
  );
}

describe('dashboards section sidebar', () => {
  beforeEach(() => {
    setPermissions();
    listFoldersMock.mockImplementation(async (parentUid) =>
      parentUid === 'team'
        ? [{ kind: 'folder', uid: 'nested', title: 'Nested folder', url: '/dashboards/f/nested' }]
        : [{ kind: 'folder', uid: 'team', title: 'Team folder', url: '/dashboards/f/team' }]
    );
    listDashboardsMock.mockImplementation(async (parentUid) =>
      parentUid === 'team' ? [{ kind: 'dashboard', uid: 'd1', title: 'Team dashboard', url: '/d/d1' }] : []
    );
  });

  it('lists the top level folders', async () => {
    renderSidebar();

    expect(await screen.findByRole('button', { name: 'Team folder' })).toBeInTheDocument();
    expect(listFoldersMock).toHaveBeenCalledWith(undefined, undefined, 1, 50);
  });

  it('expands a folder in place instead of navigating, and marks the current dashboard', async () => {
    const { user } = renderSidebar({ dashboardUid: 'd1' });

    const teamFolder = await screen.findByRole('button', { name: 'Team folder' });
    expect(teamFolder).not.toHaveAttribute('href');
    await user.click(teamFolder);

    expect(teamFolder).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('button', { name: 'Nested folder' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('loads the next page of folders when the first page is full', async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) => ({
      kind: 'folder' as const,
      uid: `f${i}`,
      title: `Folder ${i}`,
      url: `/dashboards/f/f${i}`,
    }));
    listFoldersMock.mockImplementation(async (_parentUid, _parentTitle, page) =>
      page === 1 ? firstPage : [{ kind: 'folder', uid: 'last', title: 'Last folder', url: '/dashboards/f/last' }]
    );
    renderSidebar();

    expect(await screen.findByRole('button', { name: 'Last folder' })).toBeInTheDocument();
    expect(listFoldersMock).toHaveBeenCalledWith(undefined, undefined, 2, 50);
  });

  it('searches dashboards inline', async () => {
    const { user } = renderSidebar();
    await screen.findByRole('button', { name: 'Team folder' });

    await user.type(screen.getByPlaceholderText('Search dashboards'), 'cpu');

    expect(await screen.findByRole('link', { name: 'CPU usage' })).toHaveAttribute('href', '/d/s1');
    expect(screen.queryByRole('button', { name: 'Team folder' })).not.toBeInTheDocument();
  });

  it('lists recently viewed dashboards as rows when expanded', async () => {
    const { user } = renderSidebar();
    await screen.findByRole('button', { name: 'Team folder' });

    await user.click(screen.getByRole('button', { name: 'Recent' }));

    expect(await screen.findByRole('link', { name: /Recent dashboard/ })).toHaveAttribute('href', '/d/r1');
  });

  it('links to browse dashboards and keeps the other pages under More', async () => {
    const { user } = renderSidebar();
    await screen.findByRole('button', { name: 'Team folder' });

    expect(screen.getByRole('link', { name: 'Browse dashboards' })).toHaveAttribute('href', '/dashboards');

    await user.click(screen.getByRole('button', { name: 'More' }));

    const pages = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
    expect(pages).toEqual(['Playlists', 'Snapshots', 'Library panels', 'Shared dashboards']);
  });

  it('offers the create actions the user has permission for', async () => {
    setPermissions({ canCreateFolders: false });
    const { user } = renderSidebar();
    await screen.findByRole('button', { name: 'Team folder' });

    await user.click(screen.getByRole('button', { name: 'New' }));

    expect(await screen.findByRole('menuitem', { name: 'New dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'New folder' })).not.toBeInTheDocument();
  });

  it('hides the new control without create permissions', async () => {
    setPermissions({ canCreateDashboards: false, canCreateFolders: false });
    renderSidebar();
    await screen.findByRole('button', { name: 'Team folder' });

    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
  });
});
