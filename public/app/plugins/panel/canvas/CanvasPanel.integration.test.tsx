import { render, screen } from '@testing-library/react';

import { type DataFrame, EventBusSrv, getDefaultTimeRange, LoadingState, type PanelProps } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';
import { CanvasPanel } from 'app/plugins/panel/canvas/CanvasPanel';
import { HorizontalConstraint, type Options, VerticalConstraint } from 'app/plugins/panel/canvas/panelcfg.gen';

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
            fixed: 'green',
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
            fixed: 'orange',
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
            fixed: 'red',
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
            fixed: '#808080',
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

describe('CanvasPanel', () => {
  let onFieldConfigChange = jest.fn();
  let onOptionsChange = jest.fn();
  let onChangeTimeRange = jest.fn();
  const setUp = (propsOverrides?: Partial<PanelProps<Options>>, seriesOverrides?: DataFrame[]) => {
    const timeRange = getDefaultTimeRange();
    return render(
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
        eventBus={new EventBusSrv()}
        onOptionsChange={onOptionsChange}
        replaceVariables={(s) => s}
        renderCounter={0}
        fieldConfig={{
          overrides: [],
          defaults: {},
        }}
        height={400}
        width={600}
        transparent={false}
        options={defaultOptions}
        {...propsOverrides}
      />
    );
  };

  it('renders', () => {
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
    expect(buttons[1]).toHaveTextContent('');
    expect(buttons[1].querySelector('svg')).toBeVisible();
    expect(buttons[1]).toHaveStyle('top: 60px');
    expect(buttons[1]).toHaveStyle('left: 50px');

    // Success label
    expect(buttons[2]).toHaveTextContent('Success');
    expect(buttons[2]).toHaveStyle('top: 115px');
    expect(buttons[2]).toHaveStyle('left: 30px');

    // Remaining buttons
    expect(buttons[4]).toHaveTextContent('warning');
    expect(buttons[6]).toHaveTextContent('error');
    expect(buttons[8]).toHaveTextContent('No mapping (14)');
    expect(buttons[9]).toHaveTextContent('Fixed Relative Path:');
    expect(buttons[11]).toHaveTextContent('Fixed Absolute URL:');
  });

  it('unmounts without throwing', () => {
    const { unmount } = setUp();
    expect(() => unmount()).not.toThrow();
  });
});
