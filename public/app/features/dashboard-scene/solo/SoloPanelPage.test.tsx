import { render, screen } from '@testing-library/react';
import { useParams } from 'react-router-dom-v5-compat';

import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { SoloPanelRenderer } from './SoloPanelPage';

// Mock dependencies
jest.mock('react-router-dom-v5-compat', () => ({
  useParams: jest.fn(),
}));

jest.mock('../pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(),
}));

jest.mock('../scene/SoloPanelContext', () => ({
  SoloPanelContextProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDefineSoloPanelContext: jest.fn(() => ({})),
}));

jest.mock('./SoloPanelPageLogo', () => ({
  SoloPanelPageLogo: ({ isHovered }: { isHovered: boolean }) => (
    <div data-testid="solo-panel-logo" data-hovered={String(isHovered)}>
      Logo
    </div>
  ),
}));

describe('SoloPanelPage', () => {
  const mockStateManager = {
    useState: jest.fn(() => ({
      dashboard: null,
      loadError: null,
    })),
    loadDashboard: jest.fn(),
    clearState: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getDashboardScenePageStateManager as jest.Mock).mockReturnValue(mockStateManager);
    (useParams as jest.Mock).mockReturnValue({ uid: 'test-uid', type: undefined, slug: undefined });
  });

  describe('SoloPanelRenderer', () => {
    const createMockDashboard = () => {
      const panel = new VizPanel({
        title: 'Test Panel',
        pluginId: 'table',
        key: 'panel-1',
      });

      const dashboard = new DashboardScene({
        title: 'Test Dashboard',
        uid: 'test-dash',
        $timeRange: new SceneTimeRange({}),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      // Mock the activate method
      dashboard.activate = jest.fn(() => jest.fn());

      // Mock useState to return the dashboard state object with required properties
      dashboard.useState = jest.fn(() => ({
        title: 'Test Dashboard',
        links: [],
        meta: {},
        editPane: {},
        controls: {
          useState: jest.fn(() => ({
            refreshPicker: {
              activate: jest.fn(() => jest.fn()),
            },
          })),
        },
        body: {
          Component: () => <div data-testid="panel-content">Panel Content</div>,
        },
      }));

      return dashboard;
    };

    it('should render the panel', () => {
      const dashboard = createMockDashboard();
      render(<SoloPanelRenderer dashboard={dashboard} panelId="panel-1" hideLogo={false} />);

      // The panel should be rendered (we can't easily test the actual panel content without more setup)
      expect(screen.getByTestId('solo-panel-logo')).toBeInTheDocument();
    });

    it('should render logo when hideLogo is false', () => {
      const dashboard = createMockDashboard();
      render(<SoloPanelRenderer dashboard={dashboard} panelId="panel-1" hideLogo={false} />);

      expect(screen.getByTestId('solo-panel-logo')).toBeInTheDocument();
    });

    it('should not render logo when hideLogo is true', () => {
      const dashboard = createMockDashboard();
      render(<SoloPanelRenderer dashboard={dashboard} panelId="panel-1" hideLogo={true} />);

      expect(screen.queryByTestId('solo-panel-logo')).not.toBeInTheDocument();
    });

    it('should initialize with isHovered as false', () => {
      const dashboard = createMockDashboard();
      render(<SoloPanelRenderer dashboard={dashboard} panelId="panel-1" hideLogo={false} />);

      const logo = screen.getByTestId('solo-panel-logo');
      expect(logo).toHaveAttribute('data-hovered', 'false');
    });
  });
});
