import { render, screen } from 'test/test-utils';

import { type useFolderSidebar } from '../hooks/useFolderSidebar';

import { FolderSidebar } from './FolderSidebar';

function sidebarState(overrides: Partial<ReturnType<typeof useFolderSidebar>>): ReturnType<typeof useFolderSidebar> {
  return {
    children: {},
    expanded: new Set(),
    toggle: jest.fn(),
    counts: {},
    hasSubfolders: {},
    totals: {},
    matches: undefined,
    parentTitles: {},
    teamFolders: [],
    teamFolderUids: new Set(),
    teamFoldersError: undefined,
    reload: jest.fn(),
    ...overrides,
  };
}

function renderSidebar(sidebar: ReturnType<typeof useFolderSidebar>) {
  return render(
    <FolderSidebar
      sidebar={sidebar}
      filter=""
      onFilterChange={jest.fn()}
      onSelect={jest.fn()}
      onNewFolder={jest.fn()}
      onCollapse={jest.fn()}
    />
  );
}

describe('FolderSidebar', () => {
  it('shows the expand button only on folders known to have subfolders', () => {
    renderSidebar(
      sidebarState({
        children: {
          '': [
            { uid: 'parent', title: 'Parent', parentUid: '' },
            { uid: 'leaf', title: 'Leaf', parentUid: '' },
            { uid: 'pending', title: 'Pending', parentUid: '' },
          ],
        },
        hasSubfolders: { parent: true, leaf: false },
      })
    );

    expect(screen.getByRole('button', { name: 'Expand Parent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leaf' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand Leaf' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand Pending' })).not.toBeInTheDocument();
  });
});
