import { render, screen, fireEvent } from '@testing-library/react';

import { PluginExtensionTypes } from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';

import { getMockDataSource } from '../mocks/dataSourcesMocks';

import { DataSourceTestingStatus, Props } from './DataSourceTestingStatus';

setPluginLinksHook(() => ({ links: [], isLoading: false }));

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
    expect(screen.getByTestId('data-testid Alert success')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert error')).toThrow();
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
    expect(screen.getByTestId('data-testid Alert success')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert error')).toThrow();
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
    expect(screen.getByTestId('data-testid Alert success')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert error')).toThrow();
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
    expect(screen.getByTestId('data-testid Alert error')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert success')).toThrow();
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
    expect(screen.getByTestId('data-testid Alert info')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert success')).toThrow();
    expect(() => screen.getByTestId('data-testid Alert error')).toThrow();
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
      pluginId: 'test-plugin',
      path: '/test',
      onClick: jest.fn(),
      ...overrides,
    });

    afterEach(() => {
      // Reset the hook to default empty state
      setPluginLinksHook(() => ({ links: [], isLoading: false }));
    });

    it('should render plugin links when severity is error and links exist', () => {
      const mockLinks = [
        createMockPluginLink({ id: 'link1', path: 'http://example.com/help', title: 'Help Documentation' }),
        createMockPluginLink({ id: 'link2', path: 'http://example.com/troubleshoot', title: 'Troubleshooting Guide' }),
      ];

      setPluginLinksHook(() => ({ links: mockLinks, isLoading: false }));

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
      const mockLinks = [
        createMockPluginLink({
          id: 'link1',
          path: 'http://example.com/help',
          onClick: mockOnClick,
          title: 'Help Documentation',
        }),
      ];

      setPluginLinksHook(() => ({ links: mockLinks, isLoading: false }));

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

    it('should NOT render plugin links when severity is not error even if links exist', () => {
      const mockLinks = [
        createMockPluginLink({ id: 'link1', path: 'http://example.com/help', title: 'Help Documentation' }),
      ];

      setPluginLinksHook(() => ({ links: mockLinks, isLoading: false }));

      const props = getProps({
        testingStatus: {
          status: 'success',
          message: 'Data source is working',
        },
      });

      render(<DataSourceTestingStatus {...props} />);

      expect(screen.queryByText('Help Documentation')).not.toBeInTheDocument();
    });
  });
});
