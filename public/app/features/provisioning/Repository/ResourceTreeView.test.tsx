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
  useBooleanFlagValue: jest.fn().mockReturnValue(false),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetRepositoryFilesQuery: jest.fn(),
  useGetRepositoryResourcesQuery: jest.fn(),
}));

const mockUseGetRepositoryFilesQuery = useGetRepositoryFilesQuery as jest.MockedFunction<
  typeof useGetRepositoryFilesQuery
>;
const mockUseGetRepositoryResourcesQuery = useGetRepositoryResourcesQuery as jest.MockedFunction<
  typeof useGetRepositoryResourcesQuery
>;

const repo = {
  metadata: { name: 'test-repo' },
  spec: { type: 'github', github: { url: 'https://github.com/grafana/test', branch: 'main' } },
} as unknown as Repository;

// A folder "dashboards" (inferred from the file path) containing one file and a nested subfolder
// with its own file. Enough depth to exercise folding at more than one level.
const files = [
  { path: 'dashboards/my-dashboard.json', hash: 'abc123', size: '100' },
  { path: 'dashboards/nested/other.json', hash: 'def456', size: '200' },
];

function setupQueries() {
  // Only the shape ResourceTreeView reads is relevant here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGetRepositoryFilesQuery.mockReturnValue({ data: { items: files }, isLoading: false } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGetRepositoryResourcesQuery.mockReturnValue({ data: { items: [] }, isLoading: false } as any);
}

describe('ResourceTreeView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries();
  });

  it('renders folders folded by default, hiding their contents', () => {
    render(<ResourceTreeView repo={repo} />);

    expect(screen.getByText('dashboards')).toBeInTheDocument();
    expect(screen.queryByText('my-dashboard.json')).not.toBeInTheDocument();
    expect(screen.queryByText('nested')).not.toBeInTheDocument();
  });

  it('reveals a folder’s children when its toggle is clicked and hides them again', async () => {
    render(<ResourceTreeView repo={repo} />);

    await userEvent.click(screen.getByRole('button', { name: /expand dashboards/i }));

    expect(await screen.findByText('my-dashboard.json')).toBeInTheDocument();
    // The nested subfolder appears but stays folded, so its own file is still hidden.
    expect(screen.getByText('nested')).toBeInTheDocument();
    expect(screen.queryByText('other.json')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /collapse dashboards/i }));

    expect(screen.queryByText('my-dashboard.json')).not.toBeInTheDocument();
  });

  it('shows matching nested items regardless of fold state while searching', async () => {
    render(<ResourceTreeView repo={repo} />);

    await userEvent.type(screen.getByPlaceholderText('Search by path or title'), 'other');

    // Search bypasses the folded state, so the deeply nested match is visible without expanding.
    expect(await screen.findByText('other.json')).toBeInTheDocument();
  });
});
