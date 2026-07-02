import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import {
  EventBusSrv,
  type FeatureToggles,
  getDefaultTimeRange,
  LoadingState,
  type PanelProps,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';
import { PanelContextProvider } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { CanvasPanel } from 'app/plugins/panel/canvas/CanvasPanel';
import { HorizontalConstraint, type Options, VerticalConstraint } from 'app/plugins/panel/canvas/panelcfg.gen';

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  }),
}));

const width = 600;
const height = 400;

// Two named elements: one text (testable via double-click), one icon.
// Element labels become the accessible name of the rendered "button" wrapper
// (see element.tsx renderElement), so getByRole('button', { name: ... }) is
// the most reliable way to target them.
const defaultOptions: Options = {
  inlineEditing: true,
  showAdvancedTypes: true,
  panZoom: false,
  zoomToContent: false,
  tooltip: { mode: TooltipDisplayMode.None, disableForOneClick: false },
  root: {
    name: 'Canvas Root',
    type: 'frame',
    elements: [
      {
        config: {
          align: 'center',
          color: { fixed: 'text' },
          size: 16,
          text: { fixed: 'Greeting', mode: 'fixed' },
          valign: 'middle',
        },
        constraint: { horizontal: HorizontalConstraint.Left, vertical: VerticalConstraint.Top },
        name: 'Greeting',
        placement: { height: 40, left: 20, top: 10, width: 200 },
        type: 'text',
      },
      {
        config: {
          fill: { fixed: 'blue' },
          path: { fixed: 'img/icons/unicons/cloud.svg', mode: 'fixed' },
        },
        constraint: { horizontal: HorizontalConstraint.Left, vertical: VerticalConstraint.Top },
        name: 'CloudIcon',
        placement: { height: 40, left: 300, top: 10, width: 40 },
        type: 'icon',
      },
    ],
  },
};

const flushAsync = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

interface RenderResult {
  eventBus: EventBusSrv;
  rerenderWithOptions: (next: Options) => void;
  onOptionsChange: jest.Mock;
}

const renderCanvas = (optionsOverrides?: Partial<Options>): RenderResult => {
  const eventBus = new EventBusSrv();
  const timeRange = getDefaultTimeRange();
  const onOptionsChange = jest.fn();
  const options: Options = { ...defaultOptions, ...optionsOverrides };

  const baseProps: PanelProps<Options> = {
    onChangeTimeRange: jest.fn(),
    title: '',
    timeZone: 'utc',
    timeRange,
    id: 0,
    data: { series: [], state: LoadingState.Done, timeRange },
    onFieldConfigChange: jest.fn(),
    eventBus,
    onOptionsChange,
    replaceVariables: (s: string) => s,
    renderCounter: 0,
    fieldConfig: { overrides: [], defaults: {} },
    height,
    width,
    transparent: false,
    options,
  };

  const PanelWrapper: React.FC<{ panelProps: PanelProps<Options> }> = ({ panelProps }) => {
    const [instanceState, setInstanceState] = React.useState<unknown>();
    return (
      <PanelContextProvider
        value={{
          eventsScope: 'canvas-viewer-perm-test',
          eventBus,
          instanceState,
          onInstanceStateChange: setInstanceState,
        }}
      >
        <CanvasPanel {...panelProps} />
      </PanelContextProvider>
    );
  };

  const { rerender } = render(<PanelWrapper panelProps={baseProps} />);

  const rerenderWithOptions = (next: Options) => {
    rerender(
      <PanelWrapper
        panelProps={{
          ...baseProps,
          options: next,
          renderCounter: baseProps.renderCounter + 1,
        }}
      />
    );
  };

  return { eventBus, rerenderWithOptions, onOptionsChange };
};

// Treat the test mock object as a DashboardModel-shaped thing. The Scene
// constructor only reads `editable` and `meta.canEdit`, so passing a small
// stub through `as unknown as DashboardModel` is safer than reaching into
// the full DashboardModel constructor (which spins up event subscriptions,
// time-srv, etc.) in a unit-style test.
const mockDashboard = (overrides: { editable?: boolean; meta?: { canEdit?: boolean } | undefined }) => {
  jest.spyOn(getDashboardSrv(), 'getCurrent').mockReturnValue(overrides as unknown as DashboardModel);
};

describe('CanvasPanel — viewer-role permissions (Issue #125042)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ------------------------------------------------------------------
  // Core Viewer-role scenario: dashboard.editable=true, meta.canEdit=false.
  // ------------------------------------------------------------------
  describe('Viewer (meta.canEdit=false) on an editable dashboard', () => {
    beforeEach(() => {
      mockDashboard({ editable: true, meta: { canEdit: false } });
    });

    it('does not show an edit context menu on right-click of a canvas element', async () => {
      renderCanvas();
      await flushAsync();

      const greetingButton = screen.getByRole('button', { name: 'Greeting' });
      const user = userEvent.setup();
      await user.pointer({ keys: '[MouseRight]', target: greetingButton });

      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Bring to front' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Send to back' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Open Editor' })).toBeNull();
    });

    it('does not show the "Set background" / "Add item" menu on right-click of empty canvas', async () => {
      renderCanvas();
      await flushAsync();

      const sceneRoot = screen.getByTestId('canvas-scene');
      const user = userEvent.setup();
      await user.pointer({ keys: '[MouseRight]', target: sceneRoot });

      // Background- and add-item menu items are part of the edit context
      // menu and must not surface for a Viewer.
      expect(screen.queryByRole('menuitem', { name: 'Set background' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Add item' })).toBeNull();
    });

    it('does not enter inline text-edit mode when a text element is double-clicked', async () => {
      const elementFromPointTarget: { current: HTMLElement | null } = { current: null };
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: () => elementFromPointTarget.current ?? document.body,
      });

      renderCanvas();
      await flushAsync();

      const greetingButton = screen.getByRole('button', { name: 'Greeting' });
      elementFromPointTarget.current = greetingButton;

      const user = userEvent.setup();
      await user.click(greetingButton);
      await user.dblClick(greetingButton);

      // The text element only renders a <input role="textbox"> when the
      // scene's editModeEnabled is flipped on. A Viewer must never see it.
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('keeps editing disabled across a re-render that re-loads the scene', async () => {
      const { rerenderWithOptions } = renderCanvas();
      await flushAsync();

      // Flipping `showAdvancedTypes` is one of the option changes that
      // triggers `scene.load(...)` in shouldComponentUpdate. Both the
      // constructor and that re-load must apply the same permission gate.
      rerenderWithOptions({ ...defaultOptions, showAdvancedTypes: false });
      await flushAsync();

      const greetingButton = screen.getByRole('button', { name: 'Greeting' });
      const user = userEvent.setup();
      await user.pointer({ keys: '[MouseRight]', target: greetingButton });

      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    });
  });

  // When meta or meta.canEdit are missing on the dashboard payload, the
  // scene must err on the side of read-only.
  describe('Defensive defaults for incomplete dashboard meta', () => {
    it('treats dashboard with editable=true and meta=undefined as read-only', async () => {
      mockDashboard({ editable: true });
      renderCanvas();
      await flushAsync();

      const greetingButton = screen.getByRole('button', { name: 'Greeting' });
      const user = userEvent.setup();
      await user.pointer({ keys: '[MouseRight]', target: greetingButton });

      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    });

    it('treats dashboard with editable=true and meta.canEdit=undefined as read-only', async () => {
      mockDashboard({ editable: true, meta: {} });
      renderCanvas();
      await flushAsync();

      const greetingButton = screen.getByRole('button', { name: 'Greeting' });
      const user = userEvent.setup();
      await user.pointer({ keys: '[MouseRight]', target: greetingButton });

      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    });
  });

  // The Scene has two rendering paths (selecto/moveable vs. infinite-viewer)
  // selected by canvasPanelPanZoom. Sweep the viewer scenario across both so
  // the permission gate holds regardless of the branch taken.
  describe.each([
    { flag: 'canvasPanelPanZoom', value: true },
    { flag: 'canvasPanelPanZoom', value: false },
  ])('feature toggle $flag=$value', ({ flag, value }) => {
    let previous: boolean | undefined;

    beforeAll(() => {
      previous = config.featureToggles[flag as keyof FeatureToggles] as boolean | undefined;
      config.featureToggles[flag as keyof FeatureToggles] = value;
    });
    afterAll(() => {
      config.featureToggles[flag as keyof FeatureToggles] = previous;
    });
    beforeEach(() => {
      mockDashboard({ editable: true, meta: { canEdit: false } });
    });

    it('viewer cannot right-click an element to get the edit menu', async () => {
      renderCanvas();
      await flushAsync();

      const greetingButton = screen.getByRole('button', { name: 'Greeting' });
      const user = userEvent.setup();
      await user.pointer({ keys: '[MouseRight]', target: greetingButton });

      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    });
  });
});
