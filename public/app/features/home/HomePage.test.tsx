import { render, screen } from 'test/test-utils';

import { GrafanaEdition } from '@grafana/data/internal';
import { config, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import HomePage from './HomePage';

setBackendSrv(backendSrv);
setupMockServer();

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
});

describe('HomePage', () => {
  const originalBuildInfo = { ...config.buildInfo };
  const originalNamespace = config.namespace;

  afterEach(() => {
    config.buildInfo = { ...originalBuildInfo };
    config.namespace = originalNamespace;
  });

  it('renders the greeting', async () => {
    render(<HomePage />);
    expect(await screen.findByRole('heading', { name: /^Good \w+\.$/ })).toBeInTheDocument();
  });

  it('renders the OSS welcome message', async () => {
    config.buildInfo.edition = GrafanaEdition.OpenSource;

    render(<HomePage />);
    expect(await screen.findByText('Welcome to Grafana.')).toBeInTheDocument();
  });

  it('renders dashboard tabs and auto-switches to starred', async () => {
    render(<HomePage />);
    expect(screen.getByRole('tab', { name: /recent/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /starred/i })).toBeInTheDocument();

    // Default mocks have starred dashboards but no recent impressions,
    // so auto-switch activates the Starred tab
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
  });

  it('renders the Enterprise welcome message', async () => {
    config.buildInfo.edition = GrafanaEdition.Enterprise;

    render(<HomePage />);
    expect(await screen.findByText('Welcome to Grafana Enterprise.')).toBeInTheDocument();
  });

  it('renders the Cloud welcome message', async () => {
    config.namespace = 'stacks-12345';

    render(<HomePage />);
    expect(await screen.findByText('Welcome to Grafana Cloud.')).toBeInTheDocument();
  });
});
