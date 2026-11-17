import { render, screen } from 'test/test-utils';

import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type LocationInfo } from 'app/features/search/service/types';
import { type DashboardViewItem } from 'app/features/search/types';

import { FolderParent } from './FolderParent';

jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: jest.fn(),
}));

const getFolderPaths = jest.fn();

function folder(uid: string, name: string, parentUID?: string): LocationInfo {
  return { kind: 'folder', name, url: `/dashboards/f/${uid}`, parentUID };
}

function searchItem(uid: string, parentTitle?: string): DashboardsTreeItem<DashboardViewItem> {
  return { item: { kind: 'folder', uid, title: uid, parentTitle }, level: 0, isOpen: false };
}

describe('FolderParent', () => {
  beforeEach(() => {
    jest
      .mocked(getGrafanaSearcher)
      .mockReturnValue({ getFolderPaths } as unknown as ReturnType<typeof getGrafanaSearcher>);
    getFolderPaths.mockResolvedValue({
      org: folder('org', 'Org', 'public'),
      public: folder('public', 'Public'),
      teamA: folder('teamA', 'Team A', 'org'),
      orphan: folder('orphan', 'Orphan', 'hidden'),
      deep: folder('deep', 'Deep', 'orphan'),
    });
  });

  it('shows only the immediate parent when showFullPath is off', () => {
    render(<FolderParent item={searchItem('teamA', 'Org')} />);

    expect(screen.getByText('/Org')).toBeInTheDocument();
    expect(getFolderPaths).not.toHaveBeenCalled();
  });

  it('shows every visible ancestor when showFullPath is on', async () => {
    render(<FolderParent item={searchItem('teamA', 'Org')} showFullPath />);

    expect(await screen.findByText('/Public/Org')).toBeInTheDocument();
  });

  it('falls back to the immediate parent for a root-level folder', async () => {
    render(<FolderParent item={searchItem('public', 'Dashboards')} showFullPath />);

    expect(await screen.findByText('/Dashboards')).toBeInTheDocument();
  });

  it('marks an ancestor the user cannot see', async () => {
    render(<FolderParent item={searchItem('deep', 'Orphan')} showFullPath />);

    expect(await screen.findByText('/[Unknown folder]/Orphan')).toBeInTheDocument();
  });

  it('explains the unknown folder in the tooltip', async () => {
    const { user } = render(<FolderParent item={searchItem('deep', 'Orphan')} showFullPath />);

    await user.hover(await screen.findByText('/[Unknown folder]/Orphan'));

    expect(await screen.findByText(/may not have access to one or more of the parent folders/)).toBeInTheDocument();
  });

  it('shows the full path in the tooltip', async () => {
    const { user } = render(<FolderParent item={searchItem('teamA', 'Org')} showFullPath />);

    await user.hover(await screen.findByText('/Public/Org'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('/Public/Org');
  });

  it('renders nothing for a dashboard', () => {
    const dashboard: DashboardsTreeItem<DashboardViewItem> = {
      item: { kind: 'dashboard', uid: 'd', title: 'D' },
      level: 0,
      isOpen: false,
    };
    const { container } = render(<FolderParent item={dashboard} showFullPath />);

    expect(container).toBeEmptyDOMElement();
  });
});
