import { render, screen } from '@testing-library/react';

import { VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { type PanelDataPane } from '../PanelDataPane/PanelDataPane';
import { buildPanelEditScene } from '../PanelEditor';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { VizAndDataPaneNext } from './VizAndDataPaneNext';
import { SidebarSize } from './constants';
import { useVizAndDataPaneLayout } from './hooks';

jest.mock('./hooks', () => ({
  useVizAndDataPaneLayout: jest.fn(),
  useQueryEditorBanner: jest.fn().mockReturnValue({ showBanner: false, dismissBanner: jest.fn() }),
}));

jest.mock('../QueryEditorBanner', () => ({
  QueryEditorBanner: () => <div data-testid="query-editor-banner" />,
}));

jest.mock('./QueryEditor/QueryEditorContextWrapper', () => ({
  QueryEditorContextWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./QueryEditor/Sidebar/Sidebar', () => ({
  Sidebar: () => <div data-testid="query-editor-sidebar" />,
}));

// Minimal mock so instanceof checks in VizAndDataPaneNext work without scene setup
jest.mock('./PanelDataPaneNext', () => ({
  PanelDataPaneNext: class {
    Component = () => <div data-testid="data-pane-content" />;
  },
}));

const MockPanelComponent = () => <div data-testid="panel-viz" />;

function buildMockLayout(dataPane?: PanelDataPane | PanelDataPaneNext) {
  return {
    scene: {
      panelToShow: { Component: MockPanelComponent },
      controls: null,
      dataPane,
    },
    layout: {
      sidebarSize: SidebarSize.Mini,
      setSidebarSize: jest.fn(),
      isScrollingLayout: false,
      gridStyles: {},
      sidebarResizeHandle: { ref: jest.fn(), className: '' },
      vizResizeHandle: { ref: jest.fn(), className: '' },
    },
  } as unknown as ReturnType<typeof useVizAndDataPaneLayout>;
}

const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
new DashboardGridItem({ body: panel });
const panelEditor = buildPanelEditScene(panel);

describe('VizAndDataPaneNext', () => {
  describe('when panel has no data pane (non-viz panel e.g. text, news)', () => {
    beforeEach(() => {
      jest.mocked(useVizAndDataPaneLayout).mockReturnValue(buildMockLayout(undefined));
    });

    it('renders the panel visualization', () => {
      render(<VizAndDataPaneNext model={panelEditor} />);
      expect(screen.getByTestId('panel-viz')).toBeInTheDocument();
    });

    it('does not render the query editor sidebar', () => {
      render(<VizAndDataPaneNext model={panelEditor} />);
      expect(screen.queryByTestId('query-editor-sidebar')).not.toBeInTheDocument();
    });

    it('does not render the data pane content', () => {
      render(<VizAndDataPaneNext model={panelEditor} />);
      expect(screen.queryByTestId('data-pane-content')).not.toBeInTheDocument();
    });
  });

  describe('when panel has a PanelDataPaneNext', () => {
    beforeEach(() => {
      const mockDataPane = Object.create(PanelDataPaneNext.prototype);
      mockDataPane.Component = () => <div data-testid="data-pane-content" />;
      jest.mocked(useVizAndDataPaneLayout).mockReturnValue(buildMockLayout(mockDataPane));
    });

    it('renders the query editor sidebar', () => {
      render(<VizAndDataPaneNext model={panelEditor} />);
      expect(screen.getByTestId('query-editor-sidebar')).toBeInTheDocument();
    });

    it('renders the data pane component', () => {
      render(<VizAndDataPaneNext model={panelEditor} />);
      expect(screen.getByTestId('data-pane-content')).toBeInTheDocument();
    });
  });

  describe('when panel has controls', () => {
    it('renders the controls', () => {
      const MockControls = { Component: () => <div data-testid="panel-controls" /> };
      const base = buildMockLayout(undefined);
      jest.mocked(useVizAndDataPaneLayout).mockReturnValue({
        ...base,
        scene: { ...base.scene, controls: MockControls as unknown as typeof base.scene.controls },
      });
      render(<VizAndDataPaneNext model={panelEditor} />);
      expect(screen.getByTestId('panel-controls')).toBeInTheDocument();
    });

    it('does not render controls when absent', () => {
      jest.mocked(useVizAndDataPaneLayout).mockReturnValue(buildMockLayout(undefined));
      render(<VizAndDataPaneNext model={panelEditor} />);
      expect(screen.queryByTestId('panel-controls')).not.toBeInTheDocument();
    });
  });
});
