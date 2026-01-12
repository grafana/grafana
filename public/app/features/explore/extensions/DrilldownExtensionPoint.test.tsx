import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PluginExtensionPoints, PluginExtensionTypes } from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { DrilldownExtensionPoint } from './DrilldownExtensionPoint';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  getDefaultTimeRange: jest.fn(() => ({
    raw: { from: 'now-1h', to: 'now' },
  })),
  getTimeZone: jest.fn(() => 'browser'),
  locationUtil: {
    assureBaseUrl: jest.fn((path: string) => `http://localhost${path}`),
  },
}));

const mockGlobalOpen = jest.fn();
global.open = mockGlobalOpen;

let usePluginLinksMock: jest.Mock;

beforeAll(() => {
  usePluginLinksMock = jest.fn().mockReturnValue({ links: [], isLoading: false });
  setPluginLinksHook(usePluginLinksMock);
});

afterEach(() => {
  usePluginLinksMock.mockClear();
  usePluginLinksMock.mockReturnValue({ links: [], isLoading: false });
  mockGlobalOpen.mockClear();
});

describe('DrilldownExtensionPoint', () => {
  const defaultQueries: DataQuery[] = [{ refId: 'A' }];

  it('should render the button when queryless app links are available', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        {
          pluginId: 'grafana-pyroscope-app',
          id: '1',
          type: PluginExtensionTypes.link,
          title: 'Explore Profiles',
          description: 'Explore Profiles',
          path: '/a/grafana-pyroscope-app',
        },
      ],
      isLoading: false,
    });

    render(<DrilldownExtensionPoint queries={defaultQueries} />);

    expect(screen.getByRole('button', { name: 'Drilldown' })).toBeVisible();
  });

  it('should open the first queryless app link when button is clicked', async () => {
    const user = userEvent.setup();
    usePluginLinksMock.mockReturnValue({
      links: [
        {
          pluginId: 'grafana-pyroscope-app',
          id: '1',
          type: PluginExtensionTypes.link,
          title: 'Explore Profiles',
          description: 'Explore Profiles',
          path: '/a/grafana-pyroscope-app',
        },
      ],
      isLoading: false,
    });

    render(<DrilldownExtensionPoint queries={defaultQueries} />);
    await user.click(screen.getByRole('button', { name: 'Drilldown' }));

    expect(mockGlobalOpen).toHaveBeenCalledTimes(1);
    expect(mockGlobalOpen).toHaveBeenCalledWith('http://localhost/a/grafana-pyroscope-app', '_blank');
  });

  it('should open the first link when multiple queryless app links are available', async () => {
    const user = userEvent.setup();
    usePluginLinksMock.mockReturnValue({
      links: [
        {
          pluginId: 'grafana-pyroscope-app',
          id: '1',
          type: PluginExtensionTypes.link,
          title: 'Explore Profiles',
          path: '/a/grafana-pyroscope-app',
          description: 'Explore Profiles',
        },
        {
          pluginId: 'grafana-lokiexplore-app',
          id: '2',
          type: PluginExtensionTypes.link,
          title: 'Explore Logs',
          path: '/a/grafana-lokiexplore-app',
          description: 'Explore Logs',
        },
      ],
      isLoading: false,
    });

    render(<DrilldownExtensionPoint queries={defaultQueries} />);
    await user.click(screen.getByRole('button', { name: 'Drilldown' }));

    expect(mockGlobalOpen).toHaveBeenCalledWith('http://localhost/a/grafana-pyroscope-app', '_blank');
    expect(mockGlobalOpen).toHaveBeenCalledTimes(1);
  });

  it('should pass correct context to usePluginLinks', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        {
          pluginId: 'grafana-pyroscope-app',
          id: '1',
          type: PluginExtensionTypes.link,
          title: 'Explore Profiles',
          description: 'Explore Profiles',
          path: '/a/grafana-pyroscope-app',
        },
      ],
      isLoading: false,
    });

    render(<DrilldownExtensionPoint queries={defaultQueries} />);

    expect(usePluginLinksMock).toHaveBeenCalledWith({
      extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
      context: {
        targets: defaultQueries,
        timeRange: { from: 'now-1h', to: 'now' },
        timeZone: 'browser',
      },
    });
  });

  it('should not render the button when no queryless app links are available', () => {
    usePluginLinksMock.mockReturnValue({
      links: [
        {
          pluginId: 'other-plugin',
          id: '1',
          type: PluginExtensionTypes.link,
          title: 'Other Extension',
          path: '/a/other-plugin',
          description: 'Other Extension',
        },
      ],
      isLoading: false,
    });

    const { container } = render(<DrilldownExtensionPoint queries={defaultQueries} />);

    expect(screen.queryByRole('button', { name: 'Drilldown' })).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('should not render the button when links array is empty', () => {
    usePluginLinksMock.mockReturnValue({
      links: [],
      isLoading: false,
    });

    const { container } = render(<DrilldownExtensionPoint queries={defaultQueries} />);

    expect(screen.queryByRole('button', { name: 'Drilldown' })).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('should not call global.open when link has no path', async () => {
    const user = userEvent.setup();
    usePluginLinksMock.mockReturnValue({
      links: [
        {
          pluginId: 'grafana-pyroscope-app',
          id: '1',
          type: PluginExtensionTypes.link,
          title: 'Explore Profiles',
          description: 'Explore Profiles',
        },
      ],
      isLoading: false,
    });

    render(<DrilldownExtensionPoint queries={defaultQueries} />);
    await user.click(screen.getByRole('button', { name: 'Drilldown' }));

    expect(mockGlobalOpen).not.toHaveBeenCalled();
  });

  it('should update context when queries change', () => {
    const queries1: DataQuery[] = [{ refId: 'A' }];
    const queries2: DataQuery[] = [{ refId: 'B' }];

    usePluginLinksMock.mockReturnValue({
      links: [
        {
          pluginId: 'grafana-pyroscope-app',
          id: '1',
          type: PluginExtensionTypes.link,
          title: 'Explore Profiles',
          description: 'Explore Profiles',
          path: '/a/grafana-pyroscope-app',
        },
      ],
      isLoading: false,
    });

    const { rerender } = render(<DrilldownExtensionPoint queries={queries1} />);

    expect(usePluginLinksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          targets: queries1,
        }),
      })
    );

    rerender(<DrilldownExtensionPoint queries={queries2} />);

    expect(usePluginLinksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          targets: queries2,
        }),
      })
    );
  });
});
