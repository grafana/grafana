import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { PluginExtensionPoints, PluginExtensionTypes } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { ExplorePanelData, ExploreState } from 'app/types';

import { createEmptyQueryResponse } from '../state/utils';

import { ToolbarExtensionPoint } from './ToolbarExtensionPoint';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
}));

jest.mock('app/core/services/context_srv');

const contextSrvMock = jest.mocked(contextSrv);
const usePluginLinksMock = jest.mocked(usePluginLinks);

type storeOptions = {
  targets: DataQuery[];
  data: ExplorePanelData;
};

function renderWithExploreStore(
  children: ReactNode,
  options: storeOptions = { targets: [{ refId: 'A' }], data: createEmptyQueryResponse() }
) {
  const { targets, data } = options;
  const store = configureStore({
    explore: {
      panes: {
        left: {
          queries: targets,
          queryResponse: data,
          range: {
            raw: { from: 'now-1h', to: 'now' },
          },
        },
      },
    } as unknown as ExploreState,
  });

  render(<Provider store={store}>{children}</Provider>, {});
}

describe('ToolbarExtensionPoint', () => {
  describe('with extension points', () => {
    beforeAll(() => {
      usePluginLinksMock.mockReturnValue({
        links: [
          {
            pluginId: 'grafana',
            id: '1',
            type: PluginExtensionTypes.link,
            title: 'Add to dashboard',
            category: 'Dashboards',
            description: 'Add the current query as a panel to a dashboard',
            onClick: jest.fn(),
          },
          {
            pluginId: 'grafana-ml-app',
            id: '2',
            type: PluginExtensionTypes.link,
            title: 'ML: Forecast',
            description: 'Add the query as a ML forecast',
            path: '/a/grafana-ml-ap/forecast',
          },
        ],
        isLoading: false,
      });
    });

    it('should render "Add" extension point menu button', () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      expect(screen.getByRole('button', { name: 'Add' })).toBeVisible();
    });

    it('should render menu with extensions when "Add" is clicked', async () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(screen.getByRole('group', { name: 'Dashboards' })).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'Add to dashboard' })).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'ML: Forecast' })).toBeVisible();
    });

    it('should call onClick from extension when menu item is clicked', async () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Add to dashboard' }));

      const { links } = usePluginLinksMock({
        extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
      });
      const [extension] = links;

      expect(jest.mocked(extension.onClick)).toBeCalledTimes(1);
    });

    it('should render confirm navigation modal when extension with path is clicked', async () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'ML: Forecast' }));

      expect(screen.getByRole('button', { name: 'Open in new tab' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Open' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    it('should pass a correct constructed context when fetching extensions', async () => {
      const targets = [{ refId: 'A' }];
      const data = createEmptyQueryResponse();

      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />, {
        targets,
        data,
      });

      const [options] = usePluginLinksMock.mock.calls[0];
      const { context } = options;

      expect(context).toEqual({
        exploreId: 'left',
        targets,
        data: expect.objectContaining({
          ...data,
          timeRange: expect.any(Object),
        }),
        timeZone: 'browser',
        timeRange: { from: 'now-1h', to: 'now' },
        shouldShowAddCorrelation: false,
      });
    });

    it('should pass a context with correct timeZone when fetching extensions', async () => {
      const targets = [{ refId: 'A' }];
      const data = createEmptyQueryResponse();

      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="" />, {
        targets,
        data,
      });

      const [options] = usePluginLinksMock.mock.calls[0];
      const { context } = options;

      expect(context).toHaveProperty('timeZone', 'browser');
    });

    it('should correct extension point id when fetching extensions', async () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      const [options] = usePluginLinksMock.mock.calls[0];
      const { extensionPointId } = options;

      expect(extensionPointId).toBe(PluginExtensionPoints.ExploreToolbarAction);
    });
  });

  describe('with extension points without categories', () => {
    beforeAll(() => {
      usePluginLinksMock.mockReturnValue({
        links: [
          {
            pluginId: 'grafana',
            id: '1',
            type: PluginExtensionTypes.link,
            title: 'Dashboard',
            description: 'Add the current query as a panel to a dashboard',
            onClick: jest.fn(),
          },
          {
            pluginId: 'grafana-ml-app',
            id: '2',
            type: PluginExtensionTypes.link,
            title: 'ML: Forecast',
            description: 'Add the query as a ML forecast',
            path: '/a/grafana-ml-ap/forecast',
          },
        ],
        isLoading: false,
      });
    });

    it('should render "Add" extension point menu button', () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      expect(screen.getByRole('button', { name: 'Add' })).toBeVisible();
    });

    it('should render menu with extensions when "Add" is clicked', async () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      // Make sure we don't have anything related to categories rendered
      expect(screen.queryAllByRole('group').length).toBe(0);
      expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'ML: Forecast' })).toBeVisible();
    });
  });

  describe('without extension points', () => {
    beforeAll(() => {
      contextSrvMock.hasPermission.mockReturnValue(true);
      usePluginLinksMock.mockReturnValue({ links: [], isLoading: false });
    });

    it('should render "add to dashboard" action button if one pane is visible', async () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /add to dashboard/i });

        expect(button).toBeVisible();
        expect(button).toBeEnabled();
      });
    });
  });

  describe('with insufficient permissions', () => {
    beforeAll(() => {
      contextSrvMock.hasPermission.mockReturnValue(false);
      usePluginLinksMock.mockReturnValue({ links: [], isLoading: false });
    });

    it('should not render "add to dashboard" action button', async () => {
      renderWithExploreStore(<ToolbarExtensionPoint exploreId="left" timeZone="browser" />);

      expect(screen.queryByRole('button', { name: /add to dashboard/i })).not.toBeInTheDocument();
    });
  });
});
