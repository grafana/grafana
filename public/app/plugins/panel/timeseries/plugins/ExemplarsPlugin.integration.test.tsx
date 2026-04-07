import { act, render, screen } from '@testing-library/react';
import React from 'react';
import uPlot from 'uplot';

import { applyFieldOverrides, createDataFrame, createTheme, FieldConfigOptionsRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FIXED_UNIT, type UPlotConfigBuilder } from '@grafana/ui';

import { ExemplarsPlugin } from './ExemplarsPlugin';

const defaultExemplarFrame = createDataFrame({
  name: 'exemplars',
  fields: [
    { name: 'Time', values: [1670418750000] },
    { name: 'Value', values: [0.5] },
  ],
});

let bbox = {
  left: 16,
  top: 8,
  width: 600,
  height: 400,
};

let scales = {
  x: { min: 1e12, max: 2e12 },
  y: { min: 0, max: 1 },
  [FIXED_UNIT]: { min: 0, max: 1 },
};

let valToPos = jest.fn((value: number, scaleKey?: string) => {
  if (scaleKey === 'x') {
    return 100;
  }
  return 50;
});

/**
 * Integration tests use the real `EventsCanvas` from `@grafana/ui` (no stub) and a mocked `uPlot`
 * instance so hooks (`init` → `draw`) drive `XYCanvas` and exemplar markers end-to-end.
 *
 * Shallow tests that mock `EventsCanvas` live in `ExemplarsPlugin.test.tsx`.
 */

jest.mock('uplot', () => {
  return jest.fn().mockImplementation(() => ({
    ...jest.requireActual('uplot'),
    bbox,
    scales,
    valToPos,
  }));
});

describe('ExemplarsPlugin (integration, real EventsCanvas)', () => {
  let hooks: Record<string, Array<(...args: unknown[]) => void>>;
  let config: UPlotConfigBuilder;

  beforeEach(() => {
    hooks = {};
    config = {
      addHook: jest.fn((type: string, hook: (...args: unknown[]) => void) => {
        if (!hooks[type]) {
          hooks[type] = [];
        }
        hooks[type].push(hook);
      }),
      getSeries: jest.fn(() => [
        {
          props: {
            dataFrameFieldIndex: { frameIndex: 0, fieldIndex: 1 },
            lineColor: '#73BF69',
          },
        },
      ]),
    } as unknown as UPlotConfigBuilder;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const runPlotHooks = (plot: uPlot) => {
    act(() => {
      hooks.init?.forEach((h) => {
        h(plot);
      });
    });
    act(() => {
      hooks.draw?.forEach((h) => {
        h(plot);
      });
    });
  };

  const setUp = (
    props?: Partial<React.ComponentProps<typeof ExemplarsPlugin>>,
    uPlotProps?: Partial<uPlot.Options>,
    configOverride?: Partial<UPlotConfigBuilder>,
    callHooks = true
  ) => {
    const exemplars = props?.exemplars ?? [defaultExemplarFrame];
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
      ...config,
      ...configOverride,
    } as UPlotConfigBuilder;

    const result = render(
      <div>
        <ExemplarsPlugin config={configWithDefaults} timeZone="browser" {...props} exemplars={exemplarsWithOverrides} />
      </div>
    );

    if (callHooks) {
      //@ts-ignore
      runPlotHooks(new uPlot(uPlotProps));
    }

    return result;
  };

  it('renders nothing from EventsCanvas before uPlot init and draw hooks have run', () => {
    setUp(undefined, undefined, undefined, false);

    expect(screen.queryByTestId('xy-canvas')).not.toBeInTheDocument();
  });

  it('renders xy-canvas with bbox offset after hooks run', () => {
    setUp();

    const canvas = screen.getByTestId('xy-canvas');
    expect(canvas).toBeInTheDocument();
    // XYCanvas offset uses `bbox / window.devicePixelRatio` (see EventsCanvas)
    const dpr = window.devicePixelRatio;
    expect(canvas).toHaveStyle({
      left: `${16 / dpr}px`,
      top: `${8 / dpr}px`,
    });
  });

  it('renders an exemplar marker inside the overlay when exemplar data is present', () => {
    setUp();

    expect(screen.getByTestId(selectors.components.DataSource.Prometheus.exemplarMarker)).toBeInTheDocument();
  });
});
