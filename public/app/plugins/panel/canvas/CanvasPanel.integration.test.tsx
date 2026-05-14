import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { type DataFrame, EventBusSrv, getDefaultTimeRange, LoadingState, type PanelProps } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';
import { PanelContextProvider } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { CanvasPanel } from 'app/plugins/panel/canvas/CanvasPanel';
import { HorizontalConstraint, type Options, VerticalConstraint } from 'app/plugins/panel/canvas/panelcfg.gen';

const width = 600;
const height = 400;
const colors = {
  unmapped: '#808080',
  error: '#F2495C',
  warning: '#FF9830',
  success: '#73BF69',
};

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

const getSuccessIconButton = () => {
  const candidates = screen.getAllByRole('button').filter((el) => el instanceof HTMLElement);
  return candidates[1] as HTMLElement;
};

const getSuccessIconText = () => {
  const candidates = screen.getAllByRole('button').filter((el) => el instanceof HTMLElement);
  return candidates.find((el) => el?.textContent === 'Success') ?? (candidates[2] as HTMLElement);
};

const getUnmappedIconText = () => {
  const candidates = screen.getAllByRole('button').filter((el) => el instanceof HTMLElement);
  return candidates[8] as HTMLElement;
};

describe('CanvasPanel', () => {
  let onFieldConfigChange = jest.fn();
  let onOptionsChange = jest.fn();
  let onChangeTimeRange = jest.fn();
  const canvasPanelElement = (propsOverrides?: Partial<PanelProps<Options>>, eventBus = new EventBusSrv()) => {
    const timeRange = getDefaultTimeRange();
    return (
      <CanvasPanel
        onChangeTimeRange={onChangeTimeRange}
        title={''}
        timeZone={'utc'}
        timeRange={timeRange}
        id={0}
        data={{
          // Dataframe doesn't do anything in canvas
          series: [],
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
    return render(canvasPanelElement(propsOverrides));
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

  beforeEach(() => {
    jest.spyOn(getDashboardSrv(), 'getCurrent').mockReturnValue({ editable: true } as DashboardModel);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Renders (kitchen sink)', () => {
    setUp();

    // Everything is a button!
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(13);

    // Header
    expect(buttons[0]).toBeVisible();
    expect(buttons[0]).toHaveTextContent('Field-based Icons (from value mappings):');
    expect(buttons[0]).toHaveStyle('top: 10px');
    expect(buttons[0]).toHaveStyle('left: 20px');

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

  it('Unmounts without throwing', () => {
    const { unmount } = setUp();
    expect(() => unmount()).not.toThrow();
  });

  it('Re-renders when width and height change without losing canvas elements', () => {
    const { rerender } = setUp();
    const canvas = screen.getByTestId('canvas-scene');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveStyle(`width: ${width}px`);
    expect(canvas).toHaveStyle(`height: ${height}px`);

    rerender(canvasPanelElement({ width: 800, height: 500 }));
    expect(canvas).toHaveStyle(`width: 800px`);
    expect(canvas).toHaveStyle(`height: 500px`);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(13);
    expect(buttons[0]).toBeVisible();
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

  describe('right click menu', () => {
    const user = userEvent.setup();

    const getIndex = (textContent: string) => {
      return screen.getAllByRole('button').findIndex((el) => {
        return el.textContent === textContent;
      });
    };
    const rightClickMenuSetup = async () => {
      const { rerender } = setUp();
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
  });

  describe('Canvas Inline Editor', () => {
    describe('Selected element', () => {
      // @todo
    });
    describe('Element management', () => {
      // @todo
    });
  });
});
