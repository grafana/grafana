import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import HomePage from './HomePage';

setBackendSrv(backendSrv);
setupMockServer();

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
});

describe('HomePage', () => {
  it('renders the page title and dashboard tabs', async () => {
    render(<HomePage />);
    expect(screen.getByText('Welcome to Grafana')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /starred/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No recently viewed dashboards')).toBeInTheDocument();
    });
  });
});
