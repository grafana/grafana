import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import {
  createTheme,
  type DataFrame,
  EventBusSrv,
  type FeatureToggles,
  type Field,
  FieldType,
  getDefaultTimeRange,
  getDisplayProcessor,
  LoadingState,
  MappingType,
  type PanelProps,
  toDataFrame,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';
import { PanelContextProvider } from '@grafana/ui';
import { Scene } from 'app/features/canvas/runtime/scene';
import * as sceneAbleManagement from 'app/features/canvas/runtime/sceneAbleManagement';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { CanvasPanel } from 'app/plugins/panel/canvas/CanvasPanel';
import { CONNECTION_ANCHOR_DIV_ID } from 'app/plugins/panel/canvas/components/connections/ConnectionAnchors';
import { HorizontalConstraint, type Options, VerticalConstraint } from 'app/plugins/panel/canvas/panelcfg.gen';

const theme = createTheme();

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
const colors = {
  unmapped: '#808080',
  error: '#F2495C',
  warning: '#FF9830',
  warningRGB: 'rgb(255, 152, 48)',
  success: '#73BF69',
  successRGB: 'rgb(115, 191, 105)',
  none: 'rgba(0, 0, 0, 0)',
};

const successField: Partial<Field> = {
  name: 'success',
  config: {
    mappings: [
      {
        type: MappingType.ValueToText,
        options: {
          '1': {
            color: 'green',
            icon: 'img/icons/unicons/check-circle.svg',
            index: 0,
            text: 'Success',
          },
        },
      },
      {
        type: MappingType.ValueToText,
        options: {
          '1': {
            text: 'Success',
            color: 'green',
            icon: 'img/icons/unicons/check-circle.svg',
            index: 0,
          },
          '2': {
            text: 'Warning',
            color: 'orange',
            icon: 'img/icons/unicons/exclamation-triangle.svg',
            index: 1,
          },
          '3': {
            text: 'Error',
            color: 'red',
            icon: 'img/icons/unicons/times-circle.svg',
            index: 2,
          },
        },
      },
    ],
  },
  values: [1],
  type: FieldType.number,
};
successField.display = getDisplayProcessor({ field: successField, theme });

const warningField: Partial<Field> = {
  name: 'warning',
  config: {
    mappings: [
      {
        options: {
          1: {
            color: 'orange',
            icon: 'img/icons/unicons/check-circle.svg',
            index: 0,
            text: 'Warning',
          },
        },
        type: MappingType.ValueToText,
      },
    ],
  },
  values: [1],
  type: FieldType.number,
};
warningField.display = getDisplayProcessor({ field: warningField, theme });

const errorField: Partial<Field> = {
  name: 'error',
  config: {
    mappings: [
      {
        options: {
          1: {
            color: 'red',
            icon: 'img/icons/unicons/times-circle.svg',
            index: 2,
            text: 'Error',
          },
        },
        type: MappingType.ValueToText,
      },
    ],
  },
  values: [1],
  type: FieldType.number,
};
errorField.display = getDisplayProcessor({ field: errorField, theme });

const unmappedField: Partial<Field> = {
  name: 'unmapped',
  config: {},
  values: [1],
  type: FieldType.number,
};
unmappedField.display = getDisplayProcessor({ field: unmappedField, theme });

const successIconFrame = toDataFrame({
  fields: [successField],
});

const warningIconFrame = toDataFrame({
  fields: [warningField],
});

const errorIconFrame = toDataFrame({
  fields: [errorField],
});

const unmappedFrame = toDataFrame({
  fields: [unmappedField],
});

// Good gravy this is huge @todo options builder?
const defaultOptions: Options = {
  inlineEditing: true,
  showAdvancedTypes: true,
  panZoom: false,
  zoomToContent: false,
  tooltip: {
    mode: TooltipDisplayMode.None,
    disableForOneClick: false,
  },
  root: {
    elements: [
      {
        config: {
          align: 'center',
          color: {
            fixed: 'text',
          },
          size: 16,
          text: {
            fixed: 'Field-based Icons (from value mappings):',
            mode: 'fixed',
          },
          valign: 'middle',
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Header',
        placement: {
          height: 40,
          left: 20,
          top: 10,
          width: 400,
        },
        type: 'text',
      },
      {
        config: {
          fill: {
            field: 'success',
            fixed: colors.success,
          },
          path: {
            field: 'success',
            mode: 'field',
          },
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Success Icon',
        placement: {
          height: 50,
          left: 50,
          top: 60,
          width: 50,
        },
        type: 'icon',
      },
      {
        config: {
          align: 'center',
          color: {
            field: 'success',
            fixed: 'text',
          },
          size: 12,
          text: {
            fixed: 'Success',
            mode: 'fixed',
          },
          valign: 'middle',
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Success Text',
        placement: {
          height: 25,
          left: 30,
          top: 115,
          width: 90,
        },
        type: 'text',
      },
      {
        config: {
          fill: {
            field: 'warning',
            fixed: colors.warning,
          },
          path: {
            field: 'warning',
            mode: 'field',
          },
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Warning Icon',
        placement: {
          height: 50,
          left: 180,
          top: 60,
          width: 50,
        },
        type: 'icon',
      },
      {
        config: {
          align: 'center',
          color: {
            field: 'warning',
            fixed: 'text',
          },
          size: 12,
          text: {
            fixed: 'warning',
            mode: 'field',
          },
          valign: 'middle',
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Warning Text',
        placement: {
          height: 25,
          left: 160,
          top: 115,
          width: 90,
        },
        type: 'text',
      },
      {
        config: {
          fill: {
            field: 'error',
            fixed: colors.error,
          },
          path: {
            field: 'error',
            mode: 'field',
          },
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Error Icon',
        placement: {
          height: 50,
          left: 310,
          top: 60,
          width: 50,
        },
        type: 'icon',
      },
      {
        config: {
          align: 'center',
          color: {
            field: 'error',
            fixed: 'text',
          },
          size: 12,
          text: {
            fixed: 'error',
            mode: 'field',
          },
          valign: 'middle',
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Error Text',
        placement: {
          height: 25,
          left: 290,
          top: 115,
          width: 90,
        },
        type: 'text',
      },
      {
        config: {
          fill: {
            field: 'unmapped',
            fixed: colors.unmapped,
          },
          path: {
            field: 'unmapped',
            fixed: 'img/icons/unicons/question-circle.svg',
            mode: 'field',
          },
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Unmapped Icon',
        placement: {
          height: 50,
          left: 440,
          top: 60,
          width: 50,
        },
        type: 'icon',
      },
      {
        config: {
          align: 'center',
          color: {
            field: 'unmapped',
            fixed: 'text',
          },
          size: 12,
          text: {
            fixed: 'No mapping (14)',
            mode: 'fixed',
          },
          valign: 'middle',
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Unmapped Text',
        placement: {
          height: 25,
          left: 410,
          top: 115,
          width: 110,
        },
        type: 'text',
      },
      {
        config: {
          align: 'center',
          color: {
            fixed: 'text',
          },
          size: 14,
          text: {
            fixed: 'Fixed Relative Path:',
            mode: 'fixed',
          },
          valign: 'middle',
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Relative Label',
        placement: {
          height: 30,
          left: 50,
          top: 170,
          width: 200,
        },
        type: 'text',
      },
      {
        config: {
          fill: {
            fixed: 'blue',
          },
          path: {
            fixed: 'img/icons/unicons/cloud.svg',
            mode: 'fixed',
          },
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Relative Icon',
        placement: {
          height: 50,
          left: 260,
          top: 165,
          width: 50,
        },
        type: 'icon',
      },
      {
        config: {
          align: 'center',
          color: {
            fixed: 'text',
          },
          size: 14,
          text: {
            fixed: 'Fixed Absolute URL:',
            mode: 'fixed',
          },
          valign: 'middle',
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Absolute Label',
        placement: {
          height: 30,
          left: 50,
          top: 240,
          width: 200,
        },
        type: 'text',
      },
      {
        config: {
          fill: {
            fixed: 'purple',
          },
          path: {
            fixed: 'https://grafana.com/static/assets/img/grafana_icon.svg',
            mode: 'fixed',
          },
        },
        constraint: {
          horizontal: HorizontalConstraint.Left,
          vertical: VerticalConstraint.Top,
        },
        name: 'Absolute Icon',
        placement: {
          height: 50,
          left: 260,
          top: 235,
          width: 50,
        },
        type: 'icon',
      },
    ],
    name: 'Canvas Root',
    type: 'frame',
  },
};
const getOptions = (optionsOverrides?: Partial<Options>): Options => {
  return {
    ...defaultOptions,
    ...optionsOverrides,
  };
};

const getSuccessIconButton = () => {
  const candidates = screen.getAllByRole('button').filter((el) => el instanceof HTMLElement);
  return candidates[1] as HTMLElement;
};

const getSuccessIconText = () => {
  const candidates = screen.getAllByRole('button').filter((el) => el instanceof HTMLElement);
  return candidates.find((el) => el?.textContent === 'Success') ?? (candidates[2] as HTMLElement);
};

const getCanvasPanZoomContainer = () => {
  return screen.getByTestId('canvas-scene-pan-zoom');
};

const getUnmappedIconText = () =>
  screen.getByRole('button', {
    name: 'No mapping (14)',
  }) as HTMLElement;

describe('Canvas', () => {
  let onFieldConfigChange = jest.fn();
  let onOptionsChange = jest.fn();
  let onChangeTimeRange = jest.fn();

  /** Keeps panel options in React state so controlled editors (e.g. Switch) update after onOptionsChange. */
  function StatefulCanvasPanelHarness({
    propsOverrides,
    eventBus,
  }: {
    propsOverrides?: Partial<PanelProps<Options>>;
    eventBus: EventBusSrv;
  }) {
    const [propsState, setPropsState] = React.useState<Partial<PanelProps<Options>>>(() => ({
      ...propsOverrides,
      options: propsOverrides?.options ?? defaultOptions,
    }));

    const handleOptionsChange = React.useCallback((options: Options) => {
      onOptionsChange(options);
      setPropsState((prev) => ({ ...prev, options }));
    }, []);

    const timeRange = getDefaultTimeRange();

    return (
      <CanvasPanel
        onChangeTimeRange={onChangeTimeRange}
        title={''}
        timeZone={'utc'}
        timeRange={timeRange}
        id={0}
        data={{
          series: [successIconFrame, warningIconFrame, errorIconFrame, unmappedFrame],
          state: LoadingState.Done,
          timeRange,
        }}
        onFieldConfigChange={onFieldConfigChange}
        eventBus={eventBus}
        onOptionsChange={handleOptionsChange}
        replaceVariables={(s) => s}
        renderCounter={0}
        fieldConfig={{
          overrides: [],
          defaults: {},
        }}
        height={height}
        width={width}
        transparent={false}
        options={defaultOptions}
        {...propsState}
      />
    );
  }

  const canvasPanelElement = (
    propsOverrides?: Partial<PanelProps<Options>>,
    eventBus = new EventBusSrv(),
    seriesOverrides?: DataFrame[]
  ) => {
    const timeRange = getDefaultTimeRange();

    return (
      <CanvasPanel
        onChangeTimeRange={onChangeTimeRange}
        title={''}
        timeZone={'utc'}
        timeRange={timeRange}
        id={0}
        data={{
          series: seriesOverrides ?? [successIconFrame, warningIconFrame, errorIconFrame, unmappedFrame],
          state: LoadingState.Done,
          timeRange,
        }}
        onFieldConfigChange={onFieldConfigChange}
        eventBus={eventBus}
        onOptionsChange={onOptionsChange}
        replaceVariables={(s) => s}
        renderCounter={0}
        fieldConfig={{
          overrides: [],
          defaults: {},
        }}
        height={height}
        width={width}
        transparent={false}
        options={defaultOptions}
        {...propsOverrides}
      />
    );
  };
  const setUp = (propsOverrides?: Partial<PanelProps<Options>>, seriesOverrides?: DataFrame[]) => {
    return render(canvasPanelElement(propsOverrides, undefined, seriesOverrides));
  };
  const setUpWithPanelContext = (
    propsOverrides?: Partial<PanelProps<Options>>
  ): ReturnType<typeof render> & { eventBus: EventBusSrv } => {
    const eventBus = new EventBusSrv();
    const PanelContextWrapper = ({ children }: { children: React.ReactNode }) => {
      const [instanceState, setInstanceState] = React.useState<unknown>();
      return (
        <PanelContextProvider
          value={{
            eventsScope: 'canvas-panel-integration',
            eventBus,
            instanceState,
            onInstanceStateChange: setInstanceState,
          }}
        >
          {children}
        </PanelContextProvider>
      );
    };
    return Object.assign(render(canvasPanelElement(propsOverrides, eventBus), { wrapper: PanelContextWrapper }), {
      eventBus,
    });
  };

  const setUpWithPanelContextStateful = (
    propsOverrides?: Partial<PanelProps<Options>>
  ): ReturnType<typeof render> & { eventBus: EventBusSrv } => {
    const eventBus = new EventBusSrv();
    const PanelContextWrapper = ({ children }: { children: React.ReactNode }) => {
      const [instanceState, setInstanceState] = React.useState<unknown>();
      return (
        <PanelContextProvider
          value={{
            eventsScope: 'canvas-panel-integration',
            eventBus,
            instanceState,
            onInstanceStateChange: setInstanceState,
          }}
        >
          {children}
        </PanelContextProvider>
      );
    };
    return Object.assign(
      render(
        <PanelContextWrapper>
          <StatefulCanvasPanelHarness propsOverrides={propsOverrides} eventBus={eventBus} />
        </PanelContextWrapper>
      ),
      { eventBus }
    );
  };

  const getIndex = (textContent: string) => {
    return screen.getAllByRole('button').findIndex((el) => {
      return el.textContent === textContent;
    });
  };
  const rightClickMenuSetup = async (propsOverrides?: Partial<PanelProps<Options>>) => {
    const { rerender } = setUpWithPanelContext(propsOverrides);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    rerender(canvasPanelElement({ renderCounter: 1 }));
    expect(screen.getAllByRole('button')).toHaveLength(13);
  };
  const commonEditorMenuItemAssertions = () => {
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Bring to front' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Send to back' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Open Editor' })).toBeVisible();
  };
  const user = userEvent.setup();

  beforeEach(() => {
    jest.spyOn(getDashboardSrv(), 'getCurrent').mockReturnValue({ editable: true } as DashboardModel);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('canvasPanelPanZoom enabled', () => {
    const previousFlagValue = config.featureToggles.canvasPanelPanZoom;
    beforeAll(() => (config.featureToggles.canvasPanelPanZoom = true));
    afterAll(() => (config.featureToggles.canvasPanelPanZoom = previousFlagValue));
    it('Renders - kitchen sink', () => {
      setUp(undefined, []);

      // Everything is a button!
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(13);

      // Header
      const titleElement = buttons[0];
      expect(titleElement).toBeVisible();
      expect(titleElement).toHaveTextContent('Field-based Icons (from value mappings):');
      expect(titleElement).toHaveStyle('transform: translate(20px, 10px) rotate(0deg);');

      //Success SVG icon
      expect(getSuccessIconButton()).toHaveTextContent('');
      expect(getSuccessIconButton().querySelector('svg')).toBeVisible();
      expect(getSuccessIconButton().querySelector('svg')).toHaveStyle(`fill: ${colors.success};`); // success color
      expect(getSuccessIconButton()).toHaveStyle('transform: translate(50px, 60px) rotate(0deg);');

      // Success label
      expect(getSuccessIconText()).toHaveTextContent('Success');
      expect(getSuccessIconText()).toHaveStyle('transform: translate(30px, 115px) rotate(0deg);');

      // Remaining buttons
      expect(buttons[3].querySelector('svg')).toHaveStyle(`fill: ${colors.warning};`); // warning color
      expect(buttons[4]).toHaveTextContent('warning');
      expect(buttons[5].querySelector('svg')).toHaveStyle(`fill: ${colors.error};`); // error color
      expect(buttons[6]).toHaveTextContent('error');
      expect(buttons[7].querySelector('svg')).toHaveStyle(`fill: ${colors.unmapped}`); // unmapped color
      expect(getUnmappedIconText()).toHaveTextContent('No mapping (14)');
      expect(buttons[9]).toHaveTextContent('Fixed Relative Path:');
      expect(buttons[11]).toHaveTextContent('Fixed Absolute URL:');
    });
    it('Re-renders when width and height change without losing canvas elements', () => {
      let updateConnectionsSizeSpy: jest.SpyInstance | undefined;

      const stubInfiniteViewer = {
        getZoom: jest.fn(() => 1),
        getScrollLeft: jest.fn(() => 0),
        getScrollTop: jest.fn(() => 0),
      };
      const originalUpdateConnectionsSize = Scene.prototype.updateConnectionsSize;

      // mock update connection size or infiniteViewer.getZoom will throw
      updateConnectionsSizeSpy = jest.spyOn(Scene.prototype, 'updateConnectionsSize').mockImplementation(function (
        this: Scene
      ) {
        const previous = this.infiniteViewer;
        if (!previous) {
          this.infiniteViewer = stubInfiniteViewer as unknown as Scene['infiniteViewer'];
          return originalUpdateConnectionsSize.call(this);
        }
        return originalUpdateConnectionsSize.call(this);
      });

      const { rerender } = setUp();
      expect(screen.getAllByRole('button')).toHaveLength(13);
      rerender(canvasPanelElement({ width: 800, height: 500 }));

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(13);
      expect(buttons[0]).toBeVisible();
      updateConnectionsSizeSpy?.mockRestore();
    });

    it('zoom to content', async () => {
      const calculateZoomToFitScaleSpy = jest.spyOn(sceneAbleManagement, 'calculateZoomToFitScale').mockReturnValue({
        scale: 2,
        centerX: 100,
        centerY: 100,
      });

      setUpWithPanelContextStateful({ options: getOptions({ zoomToContent: false }) });

      await user.pointer({ keys: '[MouseRight]', target: getSuccessIconText() });
      await user.click(screen.getByRole('menuitem', { name: 'Open Editor' }));

      expect(screen.getByText('Zoom to content')).toBeVisible();
      expect(getCanvasPanZoomContainer()).toHaveStyle('transform-origin: 0 0;');
      expect(getCanvasPanZoomContainer()).toHaveStyle('transform: translate3d(500px, 500px, 0px) scale(1, 1)');
      const zoomToggle = screen.getByRole('switch', {
        name: /zoom to content automatically zoom to fit content/i,
      });
      expect(zoomToggle).not.toBeChecked();

      expect(calculateZoomToFitScaleSpy).not.toHaveBeenCalled();
      await user.click(zoomToggle);
      expect(zoomToggle).toBeChecked();
      expect(calculateZoomToFitScaleSpy).toHaveBeenCalled();

      expect(getCanvasPanZoomContainer()).toHaveStyle('transform-origin: 0 0;');
      expect(getCanvasPanZoomContainer()).toHaveStyle('transform: translate3d(300px, 300px, 0px) scale(2, 2)');
    });
  });

  describe('canvasPanelPanZoom disabled', () => {
    const previousFlagValue = config.featureToggles.canvasPanelPanZoom;
    beforeAll(() => (config.featureToggles.canvasPanelPanZoom = false));
    afterAll(() => (config.featureToggles.canvasPanelPanZoom = previousFlagValue));
    it('Renders - kitchen sink', () => {
      setUp(undefined, []);

      // Everything is a button!
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(13);

      // Header
      const titleElement = buttons[0];
      expect(titleElement).toBeVisible();
      expect(titleElement).toHaveTextContent('Field-based Icons (from value mappings):');
      expect(titleElement).toHaveStyle('top: 10px');
      expect(titleElement).toHaveStyle('left: 20px');

      //Success SVG icon
      expect(getSuccessIconButton()).toHaveTextContent('');
      expect(getSuccessIconButton().querySelector('svg')).toBeVisible();
      expect(getSuccessIconButton().querySelector('svg')).toHaveStyle(`fill: ${colors.success};`); // success color
      expect(getSuccessIconButton()).toHaveStyle('top: 60px');
      expect(getSuccessIconButton()).toHaveStyle('left: 50px');

      // Success label
      expect(getSuccessIconText()).toHaveTextContent('Success');
      expect(getSuccessIconText()).toHaveStyle('top: 115px');
      expect(getSuccessIconText()).toHaveStyle('left: 30px');

      // Remaining buttons
      expect(buttons[3].querySelector('svg')).toHaveStyle(`fill: ${colors.warning};`); // warning color
      expect(buttons[4]).toHaveTextContent('warning');
      expect(buttons[5].querySelector('svg')).toHaveStyle(`fill: ${colors.error};`); // error color
      expect(buttons[6]).toHaveTextContent('error');
      expect(buttons[7].querySelector('svg')).toHaveStyle(`fill: ${colors.unmapped}`); // unmapped color
      expect(getUnmappedIconText()).toHaveTextContent('No mapping (14)');
      expect(buttons[9]).toHaveTextContent('Fixed Relative Path:');
      expect(buttons[11]).toHaveTextContent('Fixed Absolute URL:');
    });
    it('Re-renders when width and height change without losing canvas elements', () => {
      let updateConnectionsSizeSpy: jest.SpyInstance | undefined;

      const { rerender } = setUp();
      const canvas = screen.getByTestId('canvas-scene');
      expect(canvas).toHaveStyle(`width: ${width}px`);
      expect(canvas).toHaveStyle(`height: ${height}px`);

      rerender(canvasPanelElement({ width: 800, height: 500 }));

      expect(canvas).toHaveStyle(`width: 800px`);
      expect(canvas).toHaveStyle(`height: 500px`);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(13);
      expect(buttons[0]).toBeVisible();
      updateConnectionsSizeSpy?.mockRestore();
    });
    it('Double click edit', async () => {
      jest.spyOn(getDashboardSrv(), 'getCurrent').mockReturnValue({ editable: true } as DashboardModel);
      const elementFromPointTarget: { current: HTMLElement | null } = { current: null };
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: () => elementFromPointTarget.current ?? document.body,
      });
      const { rerender, eventBus } = setUpWithPanelContext();
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      rerender(canvasPanelElement({ renderCounter: 1 }, eventBus));

      const unmappedIconText = getUnmappedIconText();
      elementFromPointTarget.current = unmappedIconText;

      expect(unmappedIconText).toHaveTextContent('No mapping (14)');
      const user = userEvent.setup();
      await user.click(unmappedIconText);
      await user.dblClick(unmappedIconText);

      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
      expect(input).toHaveValue('No mapping (14)');
      await user.clear(input);
      await user.keyboard('can only edit fields with no mapping');
      expect(input).toHaveValue('can only edit fields with no mapping');

      // TextEdit exits edit mode on Enter
      await user.keyboard('{Enter}');

      const lastOptions = onOptionsChange.mock.calls.at(-1)![0] as Options;
      const unmappedTextEl = lastOptions.root.elements.find((el) => el.name === 'Unmapped Text');
      expect(unmappedTextEl).toEqual(
        expect.objectContaining({
          config: expect.objectContaining({
            text: expect.objectContaining({
              fixed: 'can only edit fields with no mapping',
            }),
          }),
        })
      );
    });
  });

  describe.each([
    { flag: 'canvasPanelPanZoom', value: true },
    { flag: 'canvasPanelPanZoom', value: false },
  ])('$flag -> $value', ({ flag, value }) => {
    const previousFlagValue = config.featureToggles[flag as keyof FeatureToggles] as boolean;

    beforeAll(() => {
      config.featureToggles[flag as keyof FeatureToggles] = value;
    });
    afterAll(() => {
      config.featureToggles[flag as keyof FeatureToggles] = previousFlagValue;
    });

    it('Unmounts without throwing', () => {
      const { unmount } = setUp();
      expect(() => unmount()).not.toThrow();
    });

    describe('right click menu', () => {
      it('Renders - icon', async () => {
        await rightClickMenuSetup();
        await user.pointer({ keys: '[MouseRight]', target: getSuccessIconButton() });

        expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
        commonEditorMenuItemAssertions();
      });
      it('Renders - text', async () => {
        await rightClickMenuSetup();

        const user = userEvent.setup();
        await user.pointer({ keys: '[MouseRight]', target: getSuccessIconText() });

        expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
        commonEditorMenuItemAssertions();
      });
      it('Deletes', async () => {
        await rightClickMenuSetup();

        // Right click to open context menu
        await user.pointer({ keys: '[MouseRight]', target: getSuccessIconButton() });
        // Delete option should be visible
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
        // Click on the delete option
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
        // Now there should be one less button
        expect(screen.getAllByRole('button')).toHaveLength(12);
      });
      it('Duplicates', async () => {
        await rightClickMenuSetup();
        await user.pointer({ keys: '[MouseRight]', target: getSuccessIconButton() });

        expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();

        // Canvas adds a moveable button on right click
        expect(screen.getAllByRole('button')).toHaveLength(14);

        await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

        expect(screen.getAllByRole('button')).toHaveLength(15);
      });
      it('Brings to front', async () => {
        await rightClickMenuSetup();

        expect(getIndex(getSuccessIconText().textContent)).toBe(2);

        await user.pointer({ keys: '[MouseRight]', target: getSuccessIconText() });
        await user.click(screen.getByRole('menuitem', { name: 'Bring to front' }));

        expect(getIndex(getSuccessIconText().textContent)).toBe(12);
      });
      it('Sends to back', async () => {
        await rightClickMenuSetup();

        expect(getIndex(getSuccessIconText().textContent)).toBe(2);

        await user.pointer({ keys: '[MouseRight]', target: getSuccessIconText() });
        await user.click(screen.getByRole('menuitem', { name: 'Send to back' }));

        expect(getIndex(getSuccessIconText().textContent)).toBe(0);
      });
      it('Opens editor', async () => {
        await rightClickMenuSetup();

        await user.pointer({ keys: '[MouseRight]', target: getSuccessIconText() });
        await user.click(screen.getByRole('menuitem', { name: 'Open Editor' }));

        expect(screen.getByText('Canvas Inline Editor')).toBeVisible();
      });

      describe('Canvas Inline Editor', () => {
        it('closes', async () => {
          await rightClickMenuSetup();

          await user.pointer({ keys: '[MouseRight]', target: getSuccessIconText() });
          await user.click(screen.getByRole('menuitem', { name: 'Open Editor' }));

          expect(screen.getByText('Canvas Inline Editor')).toBeVisible();

          // Click close button
          await userEvent.click(screen.getAllByTestId('icon-times')[0]);
          expect(screen.queryByText('Canvas Inline Editor')).not.toBeInTheDocument();
        });

        describe('Selected element', () => {
          describe('element options', () => {
            const selectElementOptionsSetup = async () => {
              await rightClickMenuSetup();
              const target = getSuccessIconText();

              await user.pointer({ keys: '[MouseRight]', target });
              // move the button to back so we can select it once the text is gone
              await user.click(screen.getByRole('menuitem', { name: 'Send to back' }));
              expect(target).toEqual(screen.getAllByRole('button')[0]);

              await user.pointer({ keys: '[MouseRight]', target });
              await user.click(screen.getByRole('menuitem', { name: 'Open Editor' }));
              await user.click(screen.getByRole('tab', { name: /selected element/i }));

              expect(screen.getByText('Selected element (Success Text)')).toBeVisible();

              const elementTypeSelect = screen
                .getAllByRole('combobox')
                .filter((el) => el.id === 'canvas-inline-nested-panel-options-type')[0];
              expect(elementTypeSelect).toBeVisible();
              // Click element type select
              await userEvent.click(elementTypeSelect);

              return target;
            };
            it('ellipse', async () => {
              const target = await selectElementOptionsSetup();
              // Click ellipse option
              await userEvent.click(screen.getAllByText('Ellipse')[0]);
              // text should have been replaced with ellipse svg element
              expect(target.querySelector('svg ellipse')).toBeVisible();
            });

            it('wind turbine', async () => {
              const target = await selectElementOptionsSetup();
              // Click wind turbine option
              await userEvent.click(screen.getAllByText('Wind Turbine')[0]);
              // text should have been replaced with wind turbine svg
              expect(target.querySelector('svg [id="blade"]')).toBeVisible();
            });

            it('Metric value mapping sets element background color using field mapping config', async () => {
              const target = await selectElementOptionsSetup();
              expect(target).toHaveStyle(`background-color: ${colors.none};`);
              mockComboboxRect();

              jest
                .spyOn(
                  jest.requireActual('app/features/canvas/runtime/element').ElementState.prototype,
                  'getTopLeftValues'
                )
                .mockReturnValue({ left: 0, top: 0, width: 260, height: 50 });

              // Click on metric value in editor
              await userEvent.click(screen.getAllByText('Metric Value')[0]);
              const metricTarget = screen.getByRole('button', { name: /Double click to set field/i });
              expect(metricTarget).toBeVisible();

              // Moveable skips emitting click when inputTarget is the root moveable element; hit inner span (matches real clicks on text).
              const metricPointerTarget = within(metricTarget).getByText(/Double click to set field/i);
              Object.defineProperty(document, 'elementFromPoint', {
                configurable: true,
                value: () => metricPointerTarget,
              });

              // Click once to focus into the canvas element and out of the editor
              await user.click(metricPointerTarget);
              // And then double click to trigger the field mapping select to get added to the UI
              await user.dblClick(metricPointerTarget);
              // Verify double click prompt has been replaced
              expect(screen.queryByText(/Double click to set field/i)).not.toBeInTheDocument();

              // Click into the select combobox
              const metricFieldCombo = within(metricTarget).getByPlaceholderText('Select field');
              await user.click(metricFieldCombo);

              // Verify the combobox is open/expanded
              expect(metricFieldCombo).toHaveAttribute('aria-expanded', 'true');

              const listboxId = metricFieldCombo.getAttribute('aria-controls') as string;
              const listbox = document.getElementById(listboxId) as HTMLElement;

              // We should have 4 options, one for each field
              expect(within(listbox).getAllByRole('option')).toHaveLength(4);
              expect(within(listbox).getByText('warning')).toBeVisible();
              expect(within(listbox).getByText('success')).toBeVisible();
              expect(within(listbox).getByText('error')).toBeVisible();
              expect(within(listbox).getByText('unmapped')).toBeVisible();

              await user.click(within(listbox).getByText('warning'));
              expect(target).toHaveStyle(`background-color: ${colors.warningRGB};`);
            });
          });

          it.todo('canvas options');
          it.todo('tooltip options');
          it.todo('Set background');
        });
        describe('Element management', () => {
          // @todo
        });
      });
    });
  });

  describe('Connections', () => {
    // Connections are super hard to test since they rely on stuff that isn't implemented in jest/RTL, if this test flakes it's probably better to delete and replace with e2e then to try and fix it
    it('connection should render on click and drag', async () => {
      // Couldn't figure out how to avoid all the console errors
      jest.spyOn(console, 'error').mockImplementation();
      const user = userEvent.setup();
      setUpWithPanelContextStateful({ options: getOptions({ zoomToContent: false }) });

      const firstAnchor = () => document.querySelectorAll('[alt="connection anchor"]')[0] as HTMLElement;

      expect(firstAnchor()).not.toBeVisible();

      await user.hover(getSuccessIconText());
      expect(firstAnchor()).toBeVisible();

      await user.hover(firstAnchor());

      const connectionControl = document.getElementById(CONNECTION_ANCHOR_DIV_ID) as HTMLElement;
      expect(connectionControl).toBeInTheDocument();
      expect(connectionControl).toBeVisible();

      expect(document.querySelectorAll('svg g line')).toHaveLength(0);

      // JSDOM does not implement `line.x1.baseVal` on the draft editor line used while dragging.
      const draftConnectionLine = screen.getByTestId('canvas-scene').querySelector('svg > line') as SVGLineElement;
      for (const prop of ['x1', 'y1', 'x2', 'y2'] as const) {
        Object.defineProperty(draftConnectionLine, prop, {
          configurable: true,
          enumerable: true,
          get() {
            const raw = draftConnectionLine.getAttribute(prop);
            const value = raw == null || raw === '' ? 0 : Number.parseFloat(raw);
            return { baseVal: { value: Number.isFinite(value) ? value : 0 } };
          },
        });
      }

      // Selecto's drag handler only recognizes the anchor highlight `#connectionControl`, not the `<img>` handles.
      const rect = connectionControl!.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;

      // Click and drag the mouse
      await user.pointer([
        { keys: '[MouseLeft>]', target: connectionControl, coords: { x: startX, y: startY } },
        { coords: { x: startX, y: startY + 20 } },
        { keys: '[/MouseLeft]', coords: { x: startX, y: startY + 20 } },
      ]);
      //
      await act(async () => {
        // connectionListener only handles `mousemove`; saving runs when a move occurs with no button
        // pressed (`!event.buttons`). A plain `mouseup` does not hit that path.
        fireEvent.mouseMove(screen.getByTestId('canvas-scene'), {
          clientX: startX,
          clientY: startY + 20,
          pageX: startX,
          pageY: startY + 20,
          buttons: 0,
        });
      });

      expect(document.querySelectorAll('svg line[id^="connectionLineId"]')).toHaveLength(2);
    });
  });
});
