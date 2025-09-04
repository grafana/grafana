import { render, screen, fireEvent } from '@testing-library/react';

import {
  PluginExtensionTypes,
  PluginExtensionLink,
  ComponentTypeWithExtensionMeta,
  PluginExtensionDataSourceConfigStatusContext,
} from '@grafana/data';
import { setPluginLinksHook, UsePluginLinksOptions, setPluginComponentsHook } from '@grafana/runtime';

import { getMockDataSource } from '../mocks/dataSourcesMocks';

import { DataSourceTestingStatus, Props } from './DataSourceTestingStatus';

// Mock contextSrv
jest.mock('../../../core/core', () => ({
  contextSrv: {
    hasAccessToExplore: jest.fn(() => true),
  },
}));

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

const getProps = (partialProps?: Partial<Props>): Props => ({
  testingStatus: {
    status: 'success',
    message: 'Test message',
  },
  exploreUrl: 'http://explore',
  dataSource: getMockDataSource(),
  ...partialProps,
});

describe('<DataSourceTestingStatus />', () => {
  it('should render', () => {
    render(<DataSourceTestingStatus {...getProps()} />);
  });

  it('should render successful message when testing status is a success', () => {
    const props = getProps({
      testingStatus: {
        status: 'success',
        message: 'Data source is definitely working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is definitely working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Data source settings page Alert')).toBeInTheDocument();
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();
  });

  it('should render successful message when testing status is uppercase "OK"', () => {
    const props = getProps({
      testingStatus: {
        status: 'OK',
        message: 'Data source is definitely working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is definitely working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Data source settings page Alert')).toBeInTheDocument();
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();
  });

  it('should render successful message when testing status is lowercase "ok"', () => {
    const props = getProps({
      testingStatus: {
        status: 'ok',
        message: 'Data source is definitely working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is definitely working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Data source settings page Alert')).toBeInTheDocument();
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();
  });

  it('should render error message when testing status is "error"', () => {
    const props = getProps({
      testingStatus: {
        status: 'error',
        message: 'Data source is definitely NOT working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is definitely NOT working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Data source settings page Alert')).toBeInTheDocument();
    expect(screen.queryByTestId('data-testid Alert success')).not.toBeInTheDocument();
  });

  it('should render info message when testing status is unknown', () => {
    const props = getProps({
      testingStatus: {
        status: 'something_weird',
        message: 'Data source is working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Data source settings page Alert')).toBeInTheDocument();
    expect(screen.queryByTestId('data-testid Alert success')).not.toBeInTheDocument();
    expect(screen.queryByTestId('data-testid Alert error')).not.toBeInTheDocument();
  });

  describe('Plugin links', () => {
    // Helper function to create mock plugin link extensions with all required properties
    const createMockPluginLink = (
      overrides: Partial<{
        id: string;
        path: string;
        onClick: jest.Mock;
        title: string;
        description: string;
        pluginId: string;
      }> = {}
    ) => ({
      id: 'test-link',
      type: PluginExtensionTypes.link as const,
      title: 'Test Link',
      description: 'Test link description',
      pluginId: 'grafana-monitoring-app', // Use an allowed plugin ID
      path: '/test',
      onClick: jest.fn(),
      ...overrides,
    });

    // Custom mock that can handle different extension points
    const setupPluginLinksMock = (statusLinks: PluginExtensionLink[] = [], errorLinks: PluginExtensionLink[] = []) => {
      setPluginLinksHook((params: UsePluginLinksOptions) => {
        // Return different links based on the extension point ID
        if (params.extensionPointId === 'grafana/datasources/config/status') {
          return { links: statusLinks, isLoading: false };
        } else if (params.extensionPointId === 'grafana/datasources/config/error-status') {
          return { links: errorLinks, isLoading: false };
        }
        return { links: [], isLoading: false };
      });
    };

    afterEach(() => {
      // Reset the hook to default empty state
      setPluginLinksHook(() => ({ links: [], isLoading: false }));
      setPluginComponentsHook(() => ({ components: [], isLoading: false }));
    });

    it('should render plugin links when severity is error and links exist', () => {
      const statusLinks = [
        createMockPluginLink({
          id: 'status-link1',
          path: 'http://example.com/help',
          title: 'Help Documentation',
          pluginId: 'grafana-monitoring-app',
        }),
      ];

      const errorLinks = [
        createMockPluginLink({
          id: 'error-link1',
          path: 'http://example.com/troubleshoot',
          title: 'Troubleshooting Guide',
          pluginId: 'grafana-troubleshooting-app',
        }),
      ];

      setupPluginLinksMock(statusLinks, errorLinks);

      const props = getProps({
        testingStatus: {
          status: 'error',
          message: 'Data source connection failed',
        },
      });

      render(<DataSourceTestingStatus {...props} />);

      expect(screen.getByText('Help Documentation')).toBeInTheDocument();
      expect(screen.getByText('Troubleshooting Guide')).toBeInTheDocument();

      const helpLink = screen.getByText('Help Documentation').closest('a');
      const troubleshootLink = screen.getByText('Troubleshooting Guide').closest('a');

      expect(helpLink).toHaveAttribute('href', 'http://example.com/help');
      expect(troubleshootLink).toHaveAttribute('href', 'http://example.com/troubleshoot');
    });

    it('should call onClick handler when plugin link is clicked', () => {
      const mockOnClick = jest.fn();
      const statusLinks = [
        createMockPluginLink({
          id: 'status-link1',
          path: 'http://example.com/help',
          onClick: mockOnClick,
          title: 'Help Documentation',
          pluginId: 'grafana-monitoring-app',
        }),
      ];

      setupPluginLinksMock(statusLinks, []);

      const props = getProps({
        testingStatus: {
          status: 'error',
          message: 'Data source connection failed',
        },
      });

      render(<DataSourceTestingStatus {...props} />);

      const helpLink = screen.getByText('Help Documentation');
      fireEvent.click(helpLink);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should render status plugin links for non-error severity but NOT error-specific links', () => {
      const statusLinks = [
        createMockPluginLink({
          id: 'status-link1',
          path: 'http://example.com/help',
          title: 'Status Help Documentation',
          pluginId: 'grafana-monitoring-app',
        }),
      ];

      const errorLinks = [
        createMockPluginLink({
          id: 'error-link1',
          path: 'http://example.com/error-help',
          title: 'Error Help Documentation',
          pluginId: 'grafana-troubleshooting-app',
        }),
      ];

      setupPluginLinksMock(statusLinks, errorLinks);

      const props = getProps({
        testingStatus: {
          status: 'success',
          message: 'Data source is working',
        },
      });

      render(<DataSourceTestingStatus {...props} />);

      // Should render status links for success severity
      expect(screen.getByText('Status Help Documentation')).toBeInTheDocument();
      // Should NOT render error-specific links for success severity
      expect(screen.queryByText('Error Help Documentation')).not.toBeInTheDocument();
    });

    it('should NOT render plugin links from non-allowed plugins', () => {
      const statusLinks = [
        createMockPluginLink({
          id: 'status-link1',
          path: 'http://example.com/help',
          title: 'Help Documentation',
          pluginId: 'not-allowed-plugin', // This should be filtered out
        }),
      ];

      setupPluginLinksMock(statusLinks, []);

      const props = getProps({
        testingStatus: {
          status: 'error',
          message: 'Data source connection failed',
        },
      });

      render(<DataSourceTestingStatus {...props} />);

      expect(screen.queryByText('Help Documentation')).not.toBeInTheDocument();
    });
  });

  describe('Plugin components', () => {
    const createMockComponent = (
      overrides: Partial<{
        id: string;
        title: string;
        description: string;
        pluginId: string;
        text: string;
      }> = {}
    ) => {
      const text = overrides.text ?? 'Test Component';
      const Comp = ((_props: PluginExtensionDataSourceConfigStatusContext) => (
        <div>{text}</div>
      )) as ComponentTypeWithExtensionMeta<PluginExtensionDataSourceConfigStatusContext>;
      Object.assign(Comp, {
        meta: {
          id: overrides.id ?? 'test-component',
          type: PluginExtensionTypes.component,
          title: overrides.title ?? 'Test Component',
          description: overrides.description ?? 'Test component description',
          pluginId: overrides.pluginId ?? 'grafana-monitoring-app',
        }
      });
      
      return Comp;
    };

    afterEach(() => {
      setPluginComponentsHook(() => ({ components: [], isLoading: false }));
    });

    it('should render plugin component from allowed plugin', () => {
      const AllowedComponent = createMockComponent({
        pluginId: 'grafana-monitoring-app',
        text: 'Allowed Component',
      }) as unknown as ComponentTypeWithExtensionMeta<{}>;
      setPluginComponentsHook(() => ({ components: [AllowedComponent], isLoading: false }));

      render(<DataSourceTestingStatus {...getProps()} />);

      expect(screen.getByText('Allowed Component')).toBeInTheDocument();
    });

    it('should NOT render plugin component from non-allowed plugin', () => {
      const BlockedComponent = createMockComponent({
        pluginId: 'not-allowed-plugin',
        text: 'Blocked Component',
      }) as unknown as ComponentTypeWithExtensionMeta<{}>;
      setPluginComponentsHook(() => ({ components: [BlockedComponent], isLoading: false }));

      render(<DataSourceTestingStatus {...getProps()} />);

      expect(screen.queryByText('Blocked Component')).not.toBeInTheDocument();
    });
  });
});
