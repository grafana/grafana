import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { VizPanel } from '@grafana/scenes';

import { type DashboardControls } from '../../scene/DashboardControls';
import { type DashboardScene } from '../../scene/DashboardScene';
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

function buildMockLayout(dataPane?: PanelDataPane | PanelDataPaneNext, sidebarSize: SidebarSize = SidebarSize.Mini) {
  return {
    scene: {
      panel: mockSceneRenderer<VizPanel>('panel-viz'),
      tableView: undefined,
      controls: undefined,
      dataPane,
      dashboard: mockSceneRenderer<DashboardScene>('dashboard'),
    },
    sidebarSize,
    setSidebarSize: jest.fn(),
    isScrollingLayout: false,
    vizDataSplitter: mockSplitter(),
    sidebarSplitter: mockSplitter(),
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
      const base = buildMockLayout(undefined);
      jest.mocked(useVizAndDataPaneLayout).mockReturnValue({
        ...base,
        scene: { ...base.scene, controls: mockSceneRenderer<DashboardControls>('panel-controls') },
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
