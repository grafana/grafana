import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import uPlot from 'uplot';

import {
  ActionType,
  applyFieldOverrides,
  createDataFrame,
  createTheme,
  FieldConfigOptionsRegistry,
  FieldType,
  HttpRequestMethod,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FIXED_UNIT, type UPlotConfigBuilder } from '@grafana/ui';

import { ExemplarsPlugin } from './ExemplarsPlugin';

const defaultExemplarFrame = createDataFrame({
  name: 'exemplars',
  fields: [
    { name: 'Time', values: [1670418750000, 1670418800000] },
    { name: 'Value', values: [0.5, 1.1] },
    {
      name: 'Field Action',
      type: FieldType.string,
      values: [],
      config: {
        actions: [
          {
            type: ActionType.Fetch,
            title: 'My action',
            [ActionType.Fetch]: { method: HttpRequestMethod.GET, url: 'http://example.com' },
          },
        ],
      },
    },
    {
      name: 'Trace Link 1',
      type: FieldType.string,
      config: {
        links: [
          {
            internal: {
              datasourceName: 'tempo',
              datasourceUid: 'test',
              query: {
                query: '${__value.raw}',
                queryType: 'traceql',
              },
            },
            title: '',
            url: '',
          },
        ],
      },
      values: ['2203801e0171aa8b', null],
    },
    {
      name: 'Trace Link 2',
      type: FieldType.string,
      config: {
        links: [
          {
            internal: {
              datasourceName: 'tempo',
              datasourceUid: 'test',
              query: {
                query: '${__value.raw}',
                queryType: 'traceql',
              },
            },
            title: '',
            url: '',
          },
        ],
      },
      values: ['2203801e0171aa8d', '2203801e0171aa8e'],
    },
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

  describe('marker', () => {
    it('renders', () => {
      setUp();
      expect(getMarker()).toBeVisible();
    });

    it.each(['click', 'hover'])('renders tooltip on %s', async (userAction) => {
      setUp();

      //@ts-expect-error
      await userEvent[userAction](getMarker());
      const tooltipWrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);

      if (userAction === 'hover') {
        expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
      } else {
        expect(screen.getByLabelText('Close')).toBeVisible();
      }

      expect(tooltipWrapper).toBeVisible();
      expect(tooltipWrapper.textContent).toContain('Exemplar');
      expect(tooltipWrapper.textContent).toContain('2022-12-07 08:12:30');
      expect(tooltipWrapper.textContent).toContain('Value');
      expect(tooltipWrapper.textContent).toContain('0.500');
    });

    it.each(['click', 'hover'])('renders data links on %s', async (userAction) => {
      setUp();
      //@ts-expect-error
      await userEvent[userAction](getMarker());
      const links = screen.getAllByRole('link');
      expect(links[0]).toBeVisible();
      expect(links[1]).toBeVisible();
      expect(screen.getByText('Trace Link 1')).toBeVisible();
      expect(screen.getByText('Trace Link 2')).toBeVisible();
      expect(screen.getByText('2203801e0171aa8b')).toBeVisible();
      expect(screen.getByText('2203801e0171aa8d')).toBeVisible();
    });

    it.each(['click', 'hover'])('renders data link on %s', async (userAction) => {
      setUp();
      //@ts-expect-error
      await userEvent[userAction](getMarker(1));
      const links = screen.getAllByRole('link');
      expect(links[0]).toBeVisible();

      expect(screen.getByText('2203801e0171aa8e')).toBeVisible();
      expect(screen.queryByText('2203801e0171aa8b')).not.toBeInTheDocument();
      expect(screen.queryByText('2203801e0171aa8d')).not.toBeInTheDocument();
    });

    it.each(['click', 'hover'])('renders link actions on %s', async (userAction) => {
      setUp();
      //@ts-expect-error
      await userEvent[userAction](getMarker());

      // Actions are currently displayed like any other field
      expect(screen.getByText('Field Action')).toBeVisible();
      // @todo link actions are not currently passed into the VizTooltipFooter, add test coverage when supported
    });
  });
});

const getMarkers = () => {
  return screen.getAllByTestId(selectors.components.DataSource.Prometheus.exemplarMarker);
};
const getMarker = (n = 0) => {
  return getMarkers()[n];
};
