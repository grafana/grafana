import { act, render, screen } from '@testing-library/react';
import uPlot from 'uplot';

import { applyFieldOverrides, createDataFrame, createTheme, FieldConfigOptionsRegistry } from '@grafana/data';
import { type UPlotConfigBuilder } from '@grafana/ui';

import { ExemplarsPlugin, getVisibleLabels, type VisibleExemplarLabels } from './ExemplarsPlugin';
import { mockAnnotationFrame } from './mocks/mockAnnotationFrames';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  EventsCanvas: ({ id }: { id: string }) => <div data-testid="exemplars-events-canvas" data-canvas-id={id} />,
}));

describe('ExemplarsPlugin', () => {
  let hooks: Record<string, (u: uPlot) => {}> = {};
  let config: Partial<UPlotConfigBuilder>;

  beforeEach(() => {
    hooks = {};
    config = {
      addHook: jest.fn((type, hook) => {
        hooks[type] = hook;
      }),
      scales: [{ props: { scaleKey: 'x' } }, { props: { scaleKey: 'y' } }],
    } as unknown as UPlotConfigBuilder;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setUp = (
    props?: Partial<React.ComponentProps<typeof ExemplarsPlugin>>,
    configOverride?: Partial<UPlotConfigBuilder>,
    uPlotProps?: Partial<uPlot.Options>,
    callInit = true
  ) => {
    function uPlotInit() {
      act(() => {
        hooks.init(
          new uPlot({
            width: 0,
            height: 0,
            series: [],
            ...uPlotProps,
          })
        );
      });
    }

    const exemplars = props?.exemplars ?? [mockAnnotationFrame];
    const frames = exemplars.map((fr) => createDataFrame(fr));
    const exemplarsWithOverrides = applyFieldOverrides({
      data: frames,
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      replaceVariables: (value) => value,
      theme: createTheme(),
      fieldConfigRegistry: new FieldConfigOptionsRegistry(),
    });

    const configWithDefaults = {
      ...configOverride,
      ...config,
    } as UPlotConfigBuilder;

    const result = render(
      <div>
        <ExemplarsPlugin
          config={configWithDefaults}
          timeZone={'browser'}
          {...props}
          exemplars={exemplarsWithOverrides}
        />
      </div>
    );

    if (callInit) {
      uPlotInit();
    }
    return result;
  };

  it('renders empty exemplars', () => {
    const config = {
      addHook: jest.fn((type, hook) => {
        hooks[type] = hook;
      }),
    } as unknown as UPlotConfigBuilder;

    setUp({ config, exemplars: [] });

    const canvas = screen.getByTestId('exemplars-events-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('data-canvas-id', 'exemplars');
  });
});

describe('getVisibleLabels()', () => {
  const dataFrameSeries1 = createDataFrame({
    name: 'tns/app',
    fields: [
      {
        name: 'Time',
        values: [1670418750000, 1670418765000, 1670418780000, 1670418795000],
      },
      {
        name: 'Value',
        labels: {
          job: 'tns/app',
        },
        values: [0.018963114754098367, 0.019140624999999974, 0.019718309859154928, 0.020064189189189167],
      },
    ],
  });
  const dataFrameSeries2 = createDataFrame({
    name: 'tns/db',
    fields: [
      {
        name: 'Time',
        values: [1670418750000, 1670418765000, 1670418780000, 1670418795000],
      },
      {
        name: 'Value',
        labels: {
          job: 'tns/db',
        },
        values: [0.028963114754098367, 0.029140624999999974, 0.029718309859154928, 0.030064189189189167],
      },
    ],
  });
  const dataFrameSeries3 = createDataFrame({
    name: 'tns/loadgen',
    fields: [
      {
        name: 'Time',
        values: [1670418750000, 1670418765000, 1670418780000, 1670418795000],
      },
      {
        name: 'Value',
        labels: {
          job: 'tns/loadgen',
        },
        values: [0.028963114754098367, 0.029140624999999974, 0.029718309859154928, 0.030064189189189167],
      },
    ],
  });
  const frames = [dataFrameSeries1, dataFrameSeries2, dataFrameSeries3];
  const config: UPlotConfigBuilder = {
    addHook: (type, hook) => {},
    series: [
      {
        props: {
          dataFrameFieldIndex: { frameIndex: 0, fieldIndex: 1 },
          show: true,
        },
      },
      {
        props: {
          dataFrameFieldIndex: { frameIndex: 1, fieldIndex: 1 },
          show: true,
        },
      },
      {
        props: {
          dataFrameFieldIndex: { frameIndex: 2, fieldIndex: 1 },
          show: false,
        },
      },
    ],
  } as UPlotConfigBuilder;

  it('function should only return labels associated with actively visible series', () => {
    const expected: VisibleExemplarLabels = {
      totalSeriesCount: 3,
      labels: [
        {
          color: '',
          labels: {
            job: 'tns/app',
          },
        },
        {
          color: '',
          labels: {
            job: 'tns/db',
          },
        },
      ],
    };

    // Base case
    expect(getVisibleLabels(config, [])).toEqual({ totalSeriesCount: 3, labels: [] });

    expect(getVisibleLabels(config, frames)).toEqual(expected);
  });
});
