import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { FeatureFlagsPage } from './FeatureFlagsPage';

const originalBackendSrv = getBackendSrv();

const navIndex = {
  labs: {
    id: 'labs',
    text: 'Labs',
    url: '/labs',
    children: [{ id: 'labs/feature-flags', text: 'Feature flags', url: '/labs/feature-flags' }],
  },
  'labs/feature-flags': {
    id: 'labs/feature-flags',
    text: 'Feature flags',
    url: '/labs/feature-flags',
    parentItem: { id: 'labs', text: 'Labs', url: '/labs' },
  },
};

describe('FeatureFlagsPage', () => {
  afterEach(() => {
    setBackendSrv(originalBackendSrv);
  });

  function renderPage() {
    const get = jest.fn().mockResolvedValue({
      allowEditing: false,
      toggles: [
        {
          name: 'lokiQuerySplitting',
          description: 'Split large interval queries into subqueries',
          stage: 'GA',
          enabled: true,
          writeable: false,
          frontend: true,
        },
        {
          name: 'live.runAPIServer',
          description: 'Registers a live apiserver',
          stage: 'experimental',
          enabled: false,
          writeable: false,
          requiresRestart: true,
          requiresDevMode: true,
        },
      ],
    });
    setBackendSrv({ ...originalBackendSrv, get });

    const result = render(<FeatureFlagsPage />, {
      store: configureStore({ navIndex }),
      historyOptions: { initialEntries: ['/labs/feature-flags'] },
    });

    return { ...result, get };
  }

  it('renders feature flags with current state and limitations', async () => {
    const { get } = renderPage();

    expect(await screen.findByText('lokiQuerySplitting')).toBeVisible();
    expect(get).toHaveBeenCalledWith('/api/admin/feature-toggles');
    expect(screen.getByText('On')).toBeVisible();
    expect(screen.getByText('Frontend only')).toBeVisible();
    expect(screen.getAllByText('Read-only')).toHaveLength(2);
    expect(screen.getByText('Restart required')).toBeVisible();
    expect(screen.getByText('Dev mode only')).toBeVisible();
  });

  it('filters feature flags', async () => {
    const { user } = renderPage();

    expect(await screen.findByText('lokiQuerySplitting')).toBeVisible();

    await user.type(screen.getByPlaceholderText('Search feature flags'), 'missing');

    expect(screen.queryByText('lokiQuerySplitting')).not.toBeInTheDocument();
    expect(screen.getByText('No feature flags found')).toBeVisible();
  });
});
