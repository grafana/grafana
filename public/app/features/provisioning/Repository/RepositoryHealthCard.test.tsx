import { render, screen } from 'test/test-utils';

import { Connection, Repository, useGetConnectionQuery } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryHealthCard } from './RepositoryHealthCard';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetConnectionQuery: jest.fn(),
}));

const mockUseGetConnectionQuery = useGetConnectionQuery as jest.Mock;

const createMockRepository = (overrides: Partial<Repository> = {}): Repository => ({
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test Repository',
    type: 'github',
    sync: { target: 'folder', enabled: true },
    workflows: [],
  },
  status: {
    health: {
      healthy: true,
      checked: Date.now(),
    },
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: {},
  },
  ...overrides,
});

const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  metadata: { name: 'test-connection' },
  spec: {
    title: 'Test Connection',
    type: 'github',
  },
  status: {
    health: { healthy: true },
    observedGeneration: 1,
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        reason: 'Available',
        message: 'Connection is available',
        lastTransitionTime: new Date().toISOString(),
        observedGeneration: 1,
      },
    ],
  },
  ...overrides,
});

describe('RepositoryHealthCard', () => {
  beforeEach(() => {
    mockUseGetConnectionQuery.mockReturnValue({ data: undefined, isLoading: false });
  });

  describe('Connection info', () => {
    it('should not show connection row when repository has no connection', () => {
      const repo = createMockRepository();
      render(<RepositoryHealthCard repo={repo} />);

      expect(screen.queryByText('Connection:')).not.toBeInTheDocument();
    });

    it('should show connection name with link when connection exists', () => {
      const connection = createMockConnection();
      mockUseGetConnectionQuery.mockReturnValue({ data: connection, isLoading: false });

      const repo = createMockRepository({
        spec: {
          title: 'Test Repository',
          type: 'github',
          sync: { target: 'folder', enabled: true },
          workflows: [],
          connection: { name: 'test-connection' },
        },
      });

      render(<RepositoryHealthCard repo={repo} />);

      expect(screen.getByText('Connection:')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Test Connection' })).toHaveAttribute(
        'href',
        '/admin/provisioning/connections/test-connection/edit'
      );
    });

    it('should show connection name as fallback when connection data is not loaded', () => {
      mockUseGetConnectionQuery.mockReturnValue({ data: undefined, isLoading: false });

      const repo = createMockRepository({
        spec: {
          title: 'Test Repository',
          type: 'github',
          sync: { target: 'folder', enabled: true },
          workflows: [],
          connection: { name: 'my-connection' },
        },
      });

      render(<RepositoryHealthCard repo={repo} />);

      expect(screen.getByText('Connection:')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'my-connection' })).toBeInTheDocument();
    });

    it('should show ConnectionStatusBadge for connection on separate row', () => {
      const connection = createMockConnection();
      mockUseGetConnectionQuery.mockReturnValue({ data: connection, isLoading: false });

      const repo = createMockRepository({
        spec: {
          title: 'Test Repository',
          type: 'github',
          sync: { target: 'folder', enabled: true },
          workflows: [],
          connection: { name: 'test-connection' },
        },
      });

      render(<RepositoryHealthCard repo={repo} />);

      expect(screen.getByText('Connection Status:')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  describe('Health status', () => {
    it('should show healthy status when repository is healthy', () => {
      const repo = createMockRepository({
        status: {
          health: { healthy: true, checked: Date.now() },
          sync: { state: 'success', message: [] },
          observedGeneration: 1,
          webhook: {},
        },
      });

      render(<RepositoryHealthCard repo={repo} />);

      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('should show unhealthy status when repository is unhealthy', () => {
      const repo = createMockRepository({
        status: {
          health: { healthy: false, checked: Date.now() },
          sync: { state: 'error', message: [] },
          observedGeneration: 1,
          webhook: {},
        },
      });

      render(<RepositoryHealthCard repo={repo} />);

      expect(screen.getByText('Unhealthy')).toBeInTheDocument();
    });
  });
});
