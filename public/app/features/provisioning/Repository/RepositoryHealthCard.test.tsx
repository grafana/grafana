import { render, screen } from 'test/test-utils';

import { Connection, Repository, useListConnectionQuery } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryHealthCard } from './RepositoryHealthCard';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useListConnectionQuery: jest.fn(),
}));

const mockUseListConnectionQuery = useListConnectionQuery as jest.Mock;

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
    mockUseListConnectionQuery.mockReturnValue({ data: { items: [] }, isLoading: false });
  });

  describe('Connection status', () => {
    it('should not show connection status when repository has no connection', () => {
      const repo = createMockRepository();
      render(<RepositoryHealthCard repo={repo} />);

      expect(screen.queryByText('Connection status:')).not.toBeInTheDocument();
    });

    it('should show connection status badge when connection exists', () => {
      const connection = createMockConnection();
      mockUseListConnectionQuery.mockReturnValue({ data: { items: [connection] }, isLoading: false });

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

      expect(screen.getByText('Connection status:')).toBeInTheDocument();
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
