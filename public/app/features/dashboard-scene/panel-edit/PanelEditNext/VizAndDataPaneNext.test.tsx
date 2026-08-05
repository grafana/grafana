import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { VizPanel } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { type PanelDataPane } from '../PanelDataPane/PanelDataPane';
import { buildPanelEditScene } from '../PanelEditor';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { VizAndDataPaneNext } from './VizAndDataPaneNext';
import { SidebarSize } from './constants';
import { useQueryEditorBanner, useVizAndDataPaneLayout } from './hooks';

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

jest.mock('../PanelEditPanelWrapper', () => ({
  PanelEditPanelWrapper: () => <div data-testid="panel-viz" />,
}));

// Minimal mock so instanceof checks in VizAndDataPaneNext work without scene setup
jest.mock('./PanelDataPaneNext', () => ({
  PanelDataPaneNext: class {
    Component = () => <div data-testid="data-pane-content" />;
  },
}));

type VizAndDataPaneLayout = ReturnType<typeof useVizAndDataPaneLayout>;
type Splitter = VizAndDataPaneLayout['vizDataSplitter'];

// Scene objects expose `Component` via a read-only getter, so a sentinel-rendering stub needs a
// boundary cast. Scoping it here keeps the rest of the layout fully type-checked.
function mockSceneRenderer<T>(testId: string): T {
  const Component = () => <div data-testid={testId} />;
  return { Component } as unknown as T;
}

function mockSplitter(collapsed = false): Splitter {
  return {
    containerProps: { ref: createRef<HTMLDivElement>(), className: '' },
    primaryProps: { ref: createRef<HTMLDivElement>(), className: '', style: {}, id: 'primary-pane' },
    secondaryProps: { ref: createRef<HTMLDivElement>(), className: '', style: {} },
    splitterProps: {
      onPointerUp: jest.fn(),
      onPointerDown: jest.fn(),
      onPointerMove: jest.fn(),
      onKeyDown: jest.fn(),
      onKeyUp: jest.fn(),
      onDoubleClick: jest.fn(),
      onBlur: jest.fn(),
      ref: createRef<HTMLDivElement>(),
      style: {},
      role: 'separator',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': 50,
      'aria-controls': 'primary-pane',
      'aria-label': 'Pane resize widget',
      tabIndex: 0,
      className: '',
    },
    splitterState: { collapsed },
    onToggleCollapse: jest.fn(),
  };
}

/** True when `first` precedes `second` in document order. */
function precedes(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function buildMockLayout(
  dataPane?: PanelDataPane | PanelDataPaneNext,
  sidebarSize: SidebarSize = SidebarSize.Mini,
  collapsed: { vizData?: boolean; sidebar?: boolean } = {}
) {
  return {
    scene: {
      panel: mockSceneRenderer<VizPanel>('panel-viz'),
      tableView: undefined,
      dataPane,
      dashboard: mockSceneRenderer<DashboardScene>('dashboard'),
    },
    sidebarSize,
    setSidebarSize: jest.fn(),
    isScrollingLayout: false,
    vizDataSplitter: mockSplitter(collapsed.vizData),
    sidebarSplitter: mockSplitter(collapsed.sidebar),
  } satisfies VizAndDataPaneLayout;
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

    // No splitter runs in this layout, so nothing supplies a flex size. Without one the pane
    // collapses to its content height — which for a scene panel is zero, leaving a blank editor.
    it('lets the viz pane grow to fill the editor', () => {
      render(<VizAndDataPaneNext model={panelEditor} />);

      const vizPane = screen.getByTestId('panel-viz').parentElement?.parentElement;
      expect(vizPane).toHaveStyle({ flexGrow: '1' });
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

    it('renders the query editor banner when enabled', () => {
      jest.mocked(useQueryEditorBanner).mockReturnValue({ showBanner: true, dismissBanner: jest.fn() });

      render(<VizAndDataPaneNext model={panelEditor} />);

      expect(screen.getByTestId('query-editor-banner')).toBeInTheDocument();
    });
  });

  /**
   * Mini and Full nest the two splitters in opposite orders, which is what makes the toggle remount
   * them and forces sizes to be held outside the splitter. Document order is the cheapest thing that
   * actually distinguishes the two topologies: Mini stacks the sidebar under the viz, Full puts it
   * alongside.
   */
  describe('sidebar topology', () => {
    function renderWithSize(sidebarSize: SidebarSize) {
      const mockDataPane = Object.create(PanelDataPaneNext.prototype);
      mockDataPane.Component = () => <div data-testid="data-pane-content" />;
      jest.mocked(useVizAndDataPaneLayout).mockReturnValue(buildMockLayout(mockDataPane, sidebarSize));

      render(<VizAndDataPaneNext model={panelEditor} />);

      return { viz: screen.getByTestId('panel-viz'), sidebar: screen.getByTestId('query-editor-sidebar') };
    }

    it('puts the sidebar after the viz in Mini, nested in the bottom pane', () => {
      const { viz, sidebar } = renderWithSize(SidebarSize.Mini);

      expect(precedes(viz, sidebar)).toBe(true);
    });

    it('puts the full-height sidebar before the viz in Full', () => {
      const { viz, sidebar } = renderWithSize(SidebarSize.Full);

      expect(precedes(sidebar, viz)).toBe(true);
    });
  });

  // Fully collapsing either pane is the point of moving to snapping splitters, so the affordance that
  // gets it back has to render and be wired up.
  describe('collapsed panes', () => {
    function renderCollapsed(collapsed: { vizData?: boolean; sidebar?: boolean }) {
      const mockDataPane = Object.create(PanelDataPaneNext.prototype);
      mockDataPane.Component = () => <div data-testid="data-pane-content" />;
      const layout = buildMockLayout(mockDataPane, SidebarSize.Mini, collapsed);
      jest.mocked(useVizAndDataPaneLayout).mockReturnValue(layout);

      render(<VizAndDataPaneNext model={panelEditor} />);

      return layout;
    }

    it('swaps the collapsed sidebar for an expand button', async () => {
      const layout = renderCollapsed({ sidebar: true });

      expect(screen.queryByTestId('query-editor-sidebar')).not.toBeInTheDocument();
      const expand = screen.getByRole('button', { name: 'Open sidebar' });

      await userEvent.click(expand);

      expect(layout.sidebarSplitter.onToggleCollapse).toHaveBeenCalled();
    });

    it('swaps the collapsed query pane for an expand button', async () => {
      const layout = renderCollapsed({ vizData: true });

      // The whole bottom pane goes, sidebar and data pane together.
      expect(screen.queryByTestId('data-pane-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('query-editor-sidebar')).not.toBeInTheDocument();
      const expand = screen.getByRole('button', { name: 'Open query pane' });

      await userEvent.click(expand);

      expect(layout.vizDataSplitter.onToggleCollapse).toHaveBeenCalled();
    });

    // The banner sits inside the bottom pane, so a collapsed query pane must hide it too.
    it('hides the banner while the query pane is collapsed', () => {
      jest.mocked(useQueryEditorBanner).mockReturnValue({ showBanner: true, dismissBanner: jest.fn() });

      renderCollapsed({ vizData: true });

      expect(screen.queryByTestId('query-editor-banner')).not.toBeInTheDocument();
    });
  });
});
