import { render, screen } from 'test/test-utils';

import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectionList } from './ConnectionList';

const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  metadata: { name: 'test-connection' },
  spec: {
    type: 'github',
    url: 'https://github.com/settings/installations/12345678',
    github: {
      appID: '123456',
      installationID: '12345678',
    },
  },
  status: {
    state: 'connected',
    health: { healthy: true },
    observedGeneration: 1,
  },
  ...overrides,
});

const mockConnections: Connection[] = [
  createMockConnection({
    metadata: { name: 'github-conn-1' },
    spec: {
      type: 'github',
      url: 'https://github.com/settings/installations/103343308',
      github: {
        appID: '123456',
        installationID: '103343308',
      },
    },
  }),
  createMockConnection({
    metadata: { name: 'gitlab-conn-2' },
    spec: { type: 'gitlab', url: 'https://gitlab.com/org2/repo2' },
  }),
  createMockConnection({
    metadata: { name: 'another-github' },
    spec: {
      type: 'github',
      url: 'https://github.com/settings/installations/987654321',
      github: {
        appID: '654321',
        installationID: '987654321',
      },
    },
  }),
];

function setup(items: Connection[] = mockConnections) {
  return render(<ConnectionList items={items} />, { renderWithRouter: true });
}

describe('ConnectionList', () => {
  describe('Rendering', () => {
    it('should render search input with correct placeholder', () => {
      setup();

      expect(screen.getByPlaceholderText('Search connections')).toBeInTheDocument();
    });

    it('should render all connection items when no filter is applied', () => {
      setup();

      // Verify all 3 connections are displayed by checking for their URL links
      expect(
        screen.getByRole('link', { name: 'https://github.com/settings/installations/103343308' })
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'https://gitlab.com/org2/repo2' })).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'https://github.com/settings/installations/987654321' })
      ).toBeInTheDocument();
    });

    it('should render EmptyState when items array is empty', () => {
      setup([]);

      expect(screen.getByText('No connections configured')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should filter connections by name', async () => {
      const { user } = setup();

      const searchInput = screen.getByPlaceholderText('Search connections');
      await user.type(searchInput, 'gitlab');

      // Should show only gitlab connection
      expect(screen.getByRole('link', { name: 'https://gitlab.com/org2/repo2' })).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'https://github.com/settings/installations/103343308' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'https://github.com/settings/installations/987654321' })
      ).not.toBeInTheDocument();
    });

    it('should filter connections by provider type', async () => {
      const { user } = setup();

      const searchInput = screen.getByPlaceholderText('Search connections');
      await user.type(searchInput, 'github');

      // Should show only github connections
      expect(
        screen.getByRole('link', { name: 'https://github.com/settings/installations/103343308' })
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'https://gitlab.com/org2/repo2' })).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'https://github.com/settings/installations/987654321' })
      ).toBeInTheDocument();
    });

    it('should be case-insensitive', async () => {
      const { user } = setup();

      const searchInput = screen.getByPlaceholderText('Search connections');
      await user.type(searchInput, 'GITLAB');

      expect(screen.getByRole('link', { name: 'https://gitlab.com/org2/repo2' })).toBeInTheDocument();
    });

    it('should show EmptyState when filter matches nothing', async () => {
      const { user } = setup();

      const searchInput = screen.getByPlaceholderText('Search connections');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No results matching your query')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'https://github.com/settings/installations/103343308' })
      ).not.toBeInTheDocument();
    });

    it('should clear filter and show all items', async () => {
      const { user } = setup();

      const searchInput = screen.getByPlaceholderText('Search connections');
      await user.type(searchInput, 'gitlab');

      // Filter applied
      expect(screen.getByRole('link', { name: 'https://gitlab.com/org2/repo2' })).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'https://github.com/settings/installations/103343308' })
      ).not.toBeInTheDocument();

      // Clear the filter
      await user.clear(searchInput);

      // All items should be visible again
      expect(
        screen.getByRole('link', { name: 'https://github.com/settings/installations/103343308' })
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'https://gitlab.com/org2/repo2' })).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'https://github.com/settings/installations/987654321' })
      ).toBeInTheDocument();
    });
  });
});
