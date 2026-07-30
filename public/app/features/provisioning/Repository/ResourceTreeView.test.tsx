import { useBooleanFlagValue } from '@openfeature/react-sdk';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import {
  type Repository,
  useGetRepositoryFilesQuery,
  useGetRepositoryResourcesQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { ResourceTreeView } from './ResourceTreeView';

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetRepositoryFilesQuery: jest.fn(),
  useGetRepositoryResourcesQuery: jest.fn(),
}));

const mockUseGetRepositoryFilesQuery = jest.mocked(useGetRepositoryFilesQuery);
const mockUseGetRepositoryResourcesQuery = jest.mocked(useGetRepositoryResourcesQuery);
const mockUseBooleanFlagValue = jest.mocked(useBooleanFlagValue);

const repo: Repository = {
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test Repository',
    type: 'github',
    github: { url: 'https://github.com/org/repo', branch: 'main' },
    sync: { target: 'folder', enabled: true },
    workflows: [],
  },
};

// The component only reads `data.items` and `isLoading`; the rest of the RTK query result is
// unused, so a partial mock is enough here.
function setupQueries(files: unknown[], resources: unknown[] = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGetRepositoryFilesQuery.mockReturnValue({ data: { items: files }, isLoading: false } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGetRepositoryResourcesQuery.mockReturnValue({ data: { items: resources }, isLoading: false } as any);
}

describe('ResourceTreeView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBooleanFlagValue.mockReturnValue(false);
  });

  describe('folding', () => {
    // A folder "dashboards" (inferred from the file path) containing one file and a nested subfolder
    // with its own file. Enough depth to exercise folding at more than one level.
    const files = [
      { path: 'dashboards/my-dashboard.json', hash: 'abc123', size: '100' },
      { path: 'dashboards/nested/other.json', hash: 'def456', size: '200' },
    ];

    beforeEach(() => {
      setupQueries(files);
    });

    it('renders folders folded by default, hiding their contents', () => {
      render(<ResourceTreeView repo={repo} />);

      expect(screen.getByText('dashboards')).toBeInTheDocument();
      expect(screen.queryByText('my-dashboard.json')).not.toBeInTheDocument();
      expect(screen.queryByText('nested')).not.toBeInTheDocument();
    });

    it('reveals a folder’s children when its toggle is clicked and hides them again', async () => {
      render(<ResourceTreeView repo={repo} />);

      // The fold toggle is labelled by the folder title (via aria-labelledby); state is on aria-expanded.
      const toggle = screen.getByRole('button', { name: 'dashboards' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(toggle);

      expect(await screen.findByText('my-dashboard.json')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'dashboards' })).toHaveAttribute('aria-expanded', 'true');
      // The nested subfolder appears but stays folded, so its own file is still hidden.
      expect(screen.getByText('nested')).toBeInTheDocument();
      expect(screen.queryByText('other.json')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'dashboards' }));

      expect(screen.queryByText('my-dashboard.json')).not.toBeInTheDocument();
    });

    it('shows matching nested items regardless of fold state while searching', async () => {
      render(<ResourceTreeView repo={repo} />);

      await userEvent.type(screen.getByPlaceholderText('Search by path or title'), 'other');

      // Search bypasses the folded state, so the deeply nested match is visible without expanding.
      expect(await screen.findByText('other.json')).toBeInTheDocument();
      // Fold toggles are disabled while searching, since search already forces everything open
      // and toggling would silently desync the stored fold state.
      expect(screen.getByRole('button', { name: 'dashboards' })).toBeDisabled();
    });
  });

  describe('status filter', () => {
    // Two dashboards under an inferred "folder": one synced (matching hashes), one not in sync.
    const files = [
      { path: 'folder/synced.json', hash: 'aaa' },
      { path: 'folder/pending.json', hash: 'bbb' },
    ];
    const resources = [
      {
        path: 'folder/synced.json',
        hash: 'aaa',
        name: 'synced-dash',
        title: 'Synced Dashboard',
        resource: 'dashboards',
        group: 'dashboard.grafana.app',
      },
      {
        path: 'folder/pending.json',
        hash: 'zzz',
        name: 'pending-dash',
        title: 'Pending Dashboard',
        resource: 'dashboards',
        group: 'dashboard.grafana.app',
      },
    ];

    beforeEach(() => {
      setupQueries(files, resources);
    });

    it('should give the status filter an accessible name', () => {
      render(<ResourceTreeView repo={repo} />);

      expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
    });

    // The Combobox list is virtualized in jsdom (only the active row renders), so options are
    // selected by keyboard: opening leaves no option active, the first ArrowDown lands on index 0.
    // An active filter force-expands the tree, so the matching dashboards become visible.
    it('should filter to only resources that are not in sync', async () => {
      const { user } = render(<ResourceTreeView repo={repo} />);

      await user.click(screen.getByRole('combobox', { name: 'Filter by status' }));
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // index 1: Not in sync

      expect(await screen.findByText('Pending Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Synced Dashboard')).not.toBeInTheDocument();
    });

    it('should filter to only synced resources', async () => {
      const { user } = render(<ResourceTreeView repo={repo} />);

      await user.click(screen.getByRole('combobox', { name: 'Filter by status' }));
      await user.keyboard('{ArrowDown}{Enter}'); // index 0: Synced

      expect(await screen.findByText('Synced Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Pending Dashboard')).not.toBeInTheDocument();
    });

    it('should apply the status filter and search together (AND) without leaving empty folders', async () => {
      const { user } = render(<ResourceTreeView repo={repo} />);

      // Search for the synced dashboard, then filter to Not in sync: nothing matches both, so the
      // parent folder must not linger just because it aggregates a (now hidden) pending child.
      await user.type(screen.getByPlaceholderText('Search by path or title'), 'synced');
      await user.click(screen.getByRole('combobox', { name: 'Filter by status' }));
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // index 1: Not in sync

      expect(screen.queryByText('Synced Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('folder')).not.toBeInTheDocument();
    });

    it('should expose the Warnings filter when the folder metadata flag is on', async () => {
      mockUseBooleanFlagValue.mockReturnValue(true);
      const { user } = render(<ResourceTreeView repo={repo} />);

      await user.click(screen.getByRole('combobox', { name: 'Filter by status' }));
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}'); // index 2: Warnings

      // None of the sample resources are missing metadata, so filtering by Warnings hides them all.
      expect(screen.queryByText('Synced Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending Dashboard')).not.toBeInTheDocument();
    });
  });
});
