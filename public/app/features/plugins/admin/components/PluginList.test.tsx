import { render, screen } from '@testing-library/react';

import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { CatalogPlugin } from '../types';

import { PluginList } from './PluginList';

jest.mock('react-router-dom-v5-compat', () => ({ useLocation: jest.fn(), useSearchParams: jest.fn() }));

const mockUseLocation = jest.requireMock('react-router-dom-v5-compat').useLocation;
const mockUseSearchParams = jest.requireMock('react-router-dom-v5-compat').useSearchParams;

const mockPlugin: CatalogPlugin = {
  description: 'Test plugin description',
  downloads: 1000,
  hasUpdate: false,
  id: 'test-plugin',
  info: { logos: { small: 'small-logo-url', large: 'large-logo-url' }, keywords: ['test', 'plugin'] },
  isDev: false,
  isCore: false,
  isEnterprise: false,
  isInstalled: true,
  isDisabled: false,
  isDeprecated: false,
  isManaged: false,
  isPreinstalled: { found: false, withVersion: false },
  isPublished: true,
  name: 'Test Plugin',
  orgName: 'Test Org',
  signature: PluginSignatureStatus.valid,
  signatureType: PluginSignatureType.grafana,
  signatureOrg: 'Test Signature Org',
  popularity: 4,
  publishedAt: '2023-01-01',
  type: PluginType.app,
  updatedAt: '2023-12-01',
  installedVersion: '1.0.0',
  angularDetected: false,
  isFullyInstalled: true,
  accessControl: {},
};

const mockPlugin2: CatalogPlugin = {
  ...mockPlugin,
  id: 'test-plugin-2',
  name: 'Test Plugin 2',
  type: PluginType.datasource,
};

describe('PluginList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: '/plugins' });
    mockUseSearchParams.mockReturnValue([new URLSearchParams(), jest.fn()]);
    config.appSubUrl = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render plugins when not loading and plugins exist', () => {
    const plugins = [mockPlugin, mockPlugin2];
    render(<PluginList plugins={plugins} isLoading={false} />);

    expect(screen.getByTestId('plugin-list')).toBeInTheDocument();
    expect(screen.getByText('Test Plugin')).toBeInTheDocument();
    expect(screen.getByText('Test Plugin 2')).toBeInTheDocument();
  });

  it('should show "All plugins are up to date" message when filterBy=has-update and no plugins', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('filterBy=has-update'), jest.fn()]);

    render(<PluginList plugins={[]} isLoading={false} />);

    expect(screen.getByText('All plugins are up to date')).toBeInTheDocument();
  });

  it('should show "No plugins found" message when filterBy=all and not loading', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('filterBy=all'), jest.fn()]);

    render(<PluginList plugins={[]} isLoading={false} />);

    expect(screen.getByText('No plugins found')).toBeInTheDocument();
  });

  it('should not show empty state when filterBy=has-update but plugins exist', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('filterBy=has-update'), jest.fn()]);

    render(<PluginList plugins={[mockPlugin]} isLoading={false} />);

    expect(screen.queryByText('All plugins are up to date')).not.toBeInTheDocument();
    expect(screen.getByText('Test Plugin')).toBeInTheDocument();
  });
});
