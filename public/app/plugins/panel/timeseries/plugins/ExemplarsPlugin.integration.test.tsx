import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import uPlot from 'uplot';

import {
  ActionType,
  applyFieldOverrides,
  createDataFrame,
  createTheme,
  type DataFrame,
  FieldConfigOptionsRegistry,
  FieldType,
  HttpRequestMethod,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FIXED_UNIT, type PanelContext, type UPlotConfigBuilder } from '@grafana/ui';

import { ExemplarsPlugin, type VisibleExemplarLabels } from './ExemplarsPlugin';

const defaultExemplarFrame = createDataFrame({
  name: 'exemplars',
  fields: [
    { name: 'Time', values: [1670418750000, 1670418800000] },
    { name: 'Value', values: [0.5, 1.1] },
    { name: 'env', type: FieldType.string, values: ['prod', 'prod'] },
    {
      name: 'job',
      type: FieldType.string,
      values: ['tns/app', 'tns/db'],
    },
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

let valToPos = jest.fn((value: number, scaleKey?: string): number => {
  if (scaleKey === 'x') {
    return 100;
  }
  return 50;
});

/**
 * Integration tests use the real `EventsCanvasView` from `@grafana/ui` (no stub) and a mocked `uPlot`
 * instance so hooks (`init` → `draw`) drive `XYCanvas` and exemplar markers end-to-end.
 */

jest.mock('uplot', () => {
  return jest.fn().mockImplementation(() => ({
    ...jest.requireActual('uplot'),
    bbox,
    scales,
    valToPos,
  }));
});

describe('ExemplarsPlugin', () => {
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
    Object.assign(plot, { hooks });
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
      runPlotHooks(new uPlot(uPlotProps as uPlot.Options));
    }

    const rerenderExemplars = (
      exemplars: DataFrame[],
      overrides?: Partial<React.ComponentProps<typeof ExemplarsPlugin>>
    ) => {
      const processed = applyFieldOverrides({
        data: exemplars,
        fieldConfig: { defaults: {}, overrides: [] },
        replaceVariables: (value) => value,
        theme: createTheme(),
        fieldConfigRegistry: new FieldConfigOptionsRegistry(),
      });
      result.rerender(
        <div>
          <ExemplarsPlugin
            config={configWithDefaults}
            timeZone="browser"
            {...props}
            {...overrides}
            exemplars={processed}
          />
        </div>
      );
    };

    return { ...result, rerenderExemplars };
  };

  const createOpenExemplar = (requestId: string, rowIndex: number) => {
    let pending = true;
    return {
      getRequest: () => (pending ? { requestId, frameIndex: 0, rowIndex } : undefined),
      onHandled: jest.fn(() => {
        pending = false;
      }),
    } satisfies NonNullable<PanelContext['openExemplar']>;
  };

  it('renders nothing before uPlot hooks', () => {
    setUp(undefined, undefined, undefined, false);

    expect(screen.queryByTestId(selectors.components.UPlotChart.xyCanvas)).not.toBeInTheDocument();
  });

  it.each([
    { name: 'no frames', exemplars: [] },
    { name: 'empty frames', exemplars: [createDataFrame({ fields: [{ name: 'Time', values: [] }] })] },
  ])('defers selection with $name and does not replay it after the overlay remounts', async ({ exemplars }) => {
    const openExemplar = createOpenExemplar('late-overlay', 0);
    const getRequest = jest.spyOn(openExemplar, 'getRequest');
    const result = setUp({ exemplars, openExemplar });

    expect(getRequest).not.toHaveBeenCalled();
    result.rerenderExemplars([defaultExemplarFrame]);
    expect(await screen.findByText('2203801e0171aa8b')).toBeVisible();
    expect(openExemplar.onHandled).toHaveBeenCalledTimes(1);

    result.rerenderExemplars(exemplars);
    expect(screen.queryByTestId(selectors.components.UPlotChart.xyCanvas)).not.toBeInTheDocument();

    result.rerenderExemplars([defaultExemplarFrame]);
    expect(getMarker()).toBeVisible();
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    await userEvent.click(getMarker());
    expect(await screen.findByText('2203801e0171aa8b')).toBeVisible();
    expect(openExemplar.onHandled).toHaveBeenCalledTimes(1);
  });

  it('opens a retained request when data arrives and preserves dismissal upon refresh', async () => {
    const result = setUp({ exemplars: [], openExemplar: createOpenExemplar('navigation-1', 1) });
    const sample = createDataFrame({
      fields: [
        { name: 'Time', values: [1670418750000, 1670418750000] },
        { name: 'Value', values: [0.5, 0.5] },
        { name: 'traceID', type: FieldType.string, values: ['wrong-trace', 'exact-trace'] },
      ],
    });
    const updateData = () => result.rerenderExemplars([sample]);

    updateData();
    expect(await screen.findByText('exact-trace')).toBeVisible();
    expect(screen.getByLabelText('Close')).toBeVisible();
    expect(screen.queryByText('wrong-trace')).not.toBeInTheDocument();

    updateData();
    expect(screen.getByText('exact-trace')).toBeVisible();
    expect(screen.getByLabelText('Close')).toBeVisible();

    await userEvent.click(screen.getByLabelText('Close'));
    updateData();

    expect(getMarker(1)).toBeVisible();
    expect(screen.queryByText('exact-trace')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('clears a hovered tooltip when another exemplar is pinned programmatically and keeps it closed after dismissal', async () => {
    const sample = createDataFrame({
      fields: [
        { name: 'Time', values: [1670418750000, 1670418800000] },
        { name: 'Value', values: [0.5, 0.6] },
        { name: 'traceID', type: FieldType.string, values: ['hovered-trace', 'requested-trace'] },
      ],
    });
    const result = setUp({ exemplars: [sample] });

    await userEvent.hover(getMarker());
    expect(await screen.findByText('hovered-trace')).toBeVisible();

    result.rerenderExemplars([sample], { openExemplar: createOpenExemplar('navigation-hover', 1) });
    expect(await screen.findByText('requested-trace')).toBeVisible();
    expect(screen.queryByText('hovered-trace')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Close'));
    expect(getMarker()).toBeVisible();
    expect(screen.queryByText('hovered-trace')).not.toBeInTheDocument();
    expect(screen.queryByText('requested-trace')).not.toBeInTheDocument();
  });

  it('does not reopen a handled request after dismissal and remount, but opens a new navigation request', async () => {
    const sample = createDataFrame({
      fields: [
        { name: 'Time', values: [1670418750000] },
        { name: 'Value', values: [0.5] },
        { name: 'traceID', type: FieldType.string, values: ['selected-trace'] },
      ],
    });
    const openExemplar = createOpenExemplar('navigation-remount', 0);
    const result = setUp({ exemplars: [sample], openExemplar });
    expect(await screen.findByText('selected-trace')).toBeVisible();

    await userEvent.click(screen.getByLabelText('Close'));
    result.unmount();
    hooks = {};
    const remounted = setUp({ exemplars: [sample], openExemplar });

    expect(getMarker()).toBeVisible();
    expect(screen.queryByText('selected-trace')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();

    remounted.unmount();
    hooks = {};
    setUp({ exemplars: [sample], openExemplar: createOpenExemplar('navigation-new', 0) });
    expect(await screen.findByText('selected-trace')).toBeVisible();
    expect(screen.getByLabelText('Close')).toBeVisible();
  });

  it('discards a hidden request so showing its series preserves a manual pin and remount cannot replay it', async () => {
    const sample = createDataFrame({
      fields: [
        { name: 'Time', values: [1670418750000, 1670418800000] },
        { name: 'Value', values: [0.5, 0.6] },
        { name: 'job', type: FieldType.string, values: ['hidden', 'visible'] },
        { name: 'traceID', type: FieldType.string, values: ['requested-trace', 'manual-trace'] },
      ],
    });
    const openExemplar = createOpenExemplar('navigation-hidden', 0);
    const result = setUp({
      exemplars: [sample],
      openExemplar,
      visibleSeries: { totalSeriesCount: 2, labels: [{ labels: { job: 'visible' } }] },
    });

    expect(getMarker()).toBeVisible();
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    await userEvent.setup({ skipHover: true }).click(getMarker());
    expect(await screen.findByText('manual-trace')).toBeVisible();

    result.rerenderExemplars([sample], {
      visibleSeries: {
        totalSeriesCount: 2,
        labels: [{ labels: { job: 'hidden' } }, { labels: { job: 'visible' } }],
      },
    });
    expect(screen.getByText('manual-trace')).toBeVisible();
    expect(screen.getByLabelText('Close')).toBeVisible();
    expect(screen.queryByText('requested-trace')).not.toBeInTheDocument();
    expect(openExemplar.onHandled).toHaveBeenCalledTimes(1);
    expect(openExemplar.onHandled).toHaveBeenCalledWith('navigation-hidden');

    result.unmount();
    hooks = {};
    setUp({ exemplars: [sample], openExemplar });
    expect(getMarker()).toBeVisible();
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    expect(screen.queryByText('requested-trace')).not.toBeInTheDocument();
  });

  it('discards a pending request when the user pins an exemplar, but allows a new navigation request', async () => {
    const sample = createDataFrame({
      fields: [
        { name: 'Time', values: [1670418750000, 1670418800000] },
        { name: 'Value', values: [0.5, 0.6] },
        { name: 'traceID', type: FieldType.string, values: ['requested-trace', 'manual-trace'] },
      ],
    });
    const invalidSample = createDataFrame({
      fields: sample.fields.map((field) => (field.name === 'Value' ? { ...field, values: [NaN, 0.6] } : field)),
    });
    const openExemplar = createOpenExemplar('navigation-delayed', 0);
    const result = setUp({ exemplars: [invalidSample], openExemplar });

    expect(getMarker()).toBeVisible();
    expect(openExemplar.onHandled).not.toHaveBeenCalled();
    await userEvent.setup({ skipHover: true }).click(getMarker());
    expect(await screen.findByText('manual-trace')).toBeVisible();

    result.rerenderExemplars([sample]);
    act(() => {
      hooks.draw.forEach((hook) => hook(new uPlot({} as uPlot.Options)));
    });

    expect(screen.getByText('manual-trace')).toBeVisible();
    expect(screen.getByLabelText('Close')).toBeVisible();
    expect(screen.queryByText('requested-trace')).not.toBeInTheDocument();
    expect(openExemplar.onHandled).toHaveBeenCalledTimes(1);
    expect(openExemplar.onHandled).toHaveBeenCalledWith('navigation-delayed');

    await userEvent.click(screen.getByLabelText('Close'));
    result.unmount();
    hooks = {};
    const remounted = setUp({ exemplars: [sample], openExemplar });
    expect(getMarker()).toBeVisible();
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();

    await userEvent.setup({ skipHover: true }).click(getMarker(1));
    expect(await screen.findByText('manual-trace')).toBeVisible();
    remounted.rerenderExemplars([sample], { openExemplar: createOpenExemplar('navigation-new', 0) });
    expect(await screen.findByText('requested-trace')).toBeVisible();
    expect(screen.getByLabelText('Close')).toBeVisible();
    expect(screen.queryByText('manual-trace')).not.toBeInTheDocument();
  });

  it('keeps a clicked exemplar pinned across replacement frames', async () => {
    const sample = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', values: [1670418750000, 1670418750000] },
        { name: 'Value', values: [0.5, 0.5] },
        { name: 'traceID', type: FieldType.string, values: ['other-trace', 'selected-trace'] },
      ],
    });
    const result = setUp({ exemplars: [sample] });
    await userEvent.setup({ skipHover: true }).click(getMarker(1));

    result.rerenderExemplars([sample]);
    expect(screen.getByText('selected-trace')).toBeVisible();
    expect(screen.getByLabelText('Close')).toBeVisible();
    expect(screen.queryByText('other-trace')).not.toBeInTheDocument();
  });

  it('consumes a request present before chart initialization once the markers render', async () => {
    const openExemplar = createOpenExemplar('navigation-early', 0);
    setUp(
      {
        openExemplar,
        exemplars: [
          createDataFrame({
            fields: [
              { name: 'Time', values: [1670418750000] },
              { name: 'Value', values: [0.5] },
              { name: 'traceID', type: FieldType.string, values: ['early-trace'] },
            ],
          }),
        ],
      },
      undefined,
      undefined,
      false
    );

    expect(openExemplar.onHandled).not.toHaveBeenCalled();
    runPlotHooks(new uPlot({} as uPlot.Options));

    expect(await screen.findByText('early-trace')).toBeVisible();
    expect(openExemplar.onHandled).toHaveBeenCalledTimes(1);
    expect(openExemplar.onHandled).toHaveBeenCalledWith('navigation-early');
    expect(screen.getByLabelText('Close')).toBeVisible();
  });

  it('renders xy-canvas', () => {
    setUp();

    const canvas = screen.getByTestId(selectors.components.UPlotChart.xyCanvas);
    expect(canvas).toBeInTheDocument();
    // XYCanvas offset uses `bbox / window.devicePixelRatio` (see EventsCanvas)
    const dpr = window.devicePixelRatio;
    expect(canvas).toHaveStyle({
      left: `${16 / dpr}px`,
      top: `${8 / dpr}px`,
    });
  });

  it('opens a pending request after a draw makes the chart coordinates available', async () => {
    const openExemplar = createOpenExemplar('navigation-scales', 0);
    const plot = new uPlot({} as uPlot.Options);
    valToPos.mockReturnValue(NaN);
    try {
      setUp({ openExemplar }, undefined, undefined, false);
      runPlotHooks(plot);

      expect(screen.getByTestId(selectors.components.UPlotChart.xyCanvas)).toBeVisible();
      expect(openExemplar.onHandled).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    } finally {
      valToPos.mockImplementation((_value: number, scaleKey?: string) => (scaleKey === 'x' ? 100 : 50));
    }

    act(() => {
      hooks.draw.forEach((hook) => hook(plot));
    });

    expect(await screen.findByText('2203801e0171aa8b')).toBeVisible();
    expect(screen.getByLabelText('Close')).toBeVisible();
    expect(openExemplar.onHandled).toHaveBeenCalledTimes(1);
    expect(openExemplar.onHandled).toHaveBeenCalledWith('navigation-scales');
  });

  it('repositions late-mounted markers on draw without a programmatic request', () => {
    const result = setUp({ exemplars: [] });
    result.rerenderExemplars([defaultExemplarFrame]);
    expect(getMarker().parentElement).toHaveStyle({ left: '100px', top: '50px' });

    valToPos.mockImplementation((_value, scaleKey) => (scaleKey === 'x' ? 200 : 75));
    try {
      act(() => {
        hooks.draw.forEach((hook) => hook());
      });
      expect(getMarker().parentElement).toHaveStyle({ left: '200px', top: '75px' });
    } finally {
      valToPos.mockImplementation((_value, scaleKey) => (scaleKey === 'x' ? 100 : 50));
    }
  });

  it('removes only its draw subscription when the overlay unmounts', () => {
    const result = setUp();
    expect(getMarker()).toBeVisible();
    const otherDrawHook = jest.fn();
    hooks.draw.push(otherDrawHook);

    result.rerenderExemplars([]);
    expect(hooks.draw).toEqual([otherDrawHook]);

    result.rerenderExemplars([defaultExemplarFrame]);
    expect(getMarker()).toBeVisible();
    expect(hooks.draw).toHaveLength(2);

    result.unmount();
    expect(hooks.draw).toEqual([otherDrawHook]);
  });

  it.each([
    { name: 'missing Time field', field: 'Time', missing: true },
    { name: 'missing Value field', field: 'Value', missing: true },
    { name: 'null time', field: 'Time', value: null },
    { name: 'null value', field: 'Value', value: null },
    { name: 'NaN time', field: 'Time', value: NaN },
    { name: 'NaN value', field: 'Value', value: NaN },
    { name: 'infinite time', field: 'Time', value: Infinity },
    { name: 'infinite value', field: 'Value', value: Infinity },
  ])(
    'keeps hover working with $name and opens the request when valid data arrives',
    async ({ field, missing, value }) => {
      const sample = createDataFrame({
        fields: [
          { name: 'Time', values: [1670418750000] },
          { name: 'Value', values: [0.5] },
          { name: 'traceID', type: FieldType.string, values: ['requested-trace'] },
        ],
      });
      const invalidSample = createDataFrame({
        fields: sample.fields
          .filter((f) => !missing || f.name !== field)
          .map((f) => (f.name === field ? { ...f, values: [value] } : f)),
      });
      const hoverSample = createDataFrame({
        fields: [
          { name: 'Time', values: [1670418800000] },
          { name: 'Value', values: [0.7] },
          { name: 'traceID', type: FieldType.string, values: ['hover-trace'] },
        ],
      });
      const openExemplar = createOpenExemplar('navigation-invalid', 0);
      const result = setUp({ exemplars: [invalidSample, hoverSample], openExemplar });

      expect(getMarkers()).toHaveLength(1);
      await userEvent.hover(getMarker());
      expect(await screen.findByText('hover-trace')).toBeVisible();
      expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
      expect(openExemplar.onHandled).not.toHaveBeenCalled();

      await userEvent.unhover(getMarker());
      result.rerenderExemplars([sample, hoverSample]);

      expect(await screen.findByText('requested-trace')).toBeVisible();
      expect(screen.getByLabelText('Close')).toBeVisible();
      expect(openExemplar.onHandled).toHaveBeenCalledTimes(1);
      expect(openExemplar.onHandled).toHaveBeenCalledWith('navigation-invalid');
    }
  );

  describe('marker', () => {
    it('renders', () => {
      setUp();
      expect(getMarker()).toBeVisible();
    });

    describe('visibleSeries', () => {
      it('sets marker fill', () => {
        const seriesColor1 = '#CA95E5';
        const seriesColor2 = '#5794F2';

        setUp({
          visibleSeries: {
            totalSeriesCount: 2,
            labels: [
              { labels: { job: 'tns/app' }, color: seriesColor1 },
              { labels: { job: 'tns/db' }, color: seriesColor2 },
            ],
          },
        });

        const [marker0, marker1] = getMarkers();
        expect(marker0.querySelector('rect')).toHaveAttribute('fill', seriesColor1);
        expect(marker1.querySelector('rect')).toHaveAttribute('fill', seriesColor2);
      });

      it('uses legend color when every exemplar that maps to legend keys matches that legend row', () => {
        const visibleSeries: VisibleExemplarLabels = {
          totalSeriesCount: 1,
          labels: [
            {
              labels: { job: 'tns/app', env: 'prod' },
              color: '#FF9830',
            },
          ],
        };

        setUp({ visibleSeries });

        expect(getMarker().querySelector('rect')).toHaveAttribute('fill', '#FF9830');
      });

      it('uses the first matching label', () => {
        const frame = createDataFrame({
          name: 'exemplars',
          fields: [
            { name: 'Time', values: [1670418750000] },
            { name: 'Value', values: [0.5] },
            { name: 'job', type: FieldType.string, values: ['shared'] },
          ],
        });

        const visibleSeries: VisibleExemplarLabels = {
          totalSeriesCount: 2,
          labels: [
            { labels: { job: 'shared' }, color: '#first' },
            { labels: { job: 'shared' }, color: '#second' },
          ],
        };

        setUp({ exemplars: [frame], visibleSeries });

        expect(getMarker().querySelector('rect')).toHaveAttribute('fill', '#first');
      });

      it('does not use legend color for fill when labels do not match', () => {
        const frame = createDataFrame({
          name: 'exemplars',
          fields: [
            { name: 'Time', values: [1670418750000] },
            { name: 'Value', values: [0.5] },
            { name: 'job', type: FieldType.string, values: ['other'] },
          ],
        });

        const visibleSeries: VisibleExemplarLabels = {
          totalSeriesCount: 1,
          labels: [{ labels: { job: 'tns/app' }, color: '#5794F2' }],
        };

        setUp({ exemplars: [frame], visibleSeries });

        const rect = getMarker().querySelector('rect');
        expect(rect).toBeVisible();
        expect(rect).not.toHaveAttribute('fill', '#5794F2');
      });

      it('hides markers that do not match visible legend series', () => {
        setUp({
          visibleSeries: {
            totalSeriesCount: 2,
            labels: [{ labels: { job: 'tns/app', env: 'prod' }, color: '#CA95E5' }],
          },
        });

        expect(screen.queryAllByTestId(selectors.components.DataSource.Prometheus.exemplarMarker)).toHaveLength(1);
        expect(getMarker().querySelector('rect')).toHaveAttribute('fill', '#CA95E5');
      });

      it('shows exemplar markers with a visible legend with empty label', () => {
        setUp({
          visibleSeries: {
            totalSeriesCount: 2,
            labels: [{ labels: {}, color: '#73BF69' }],
          },
        });

        expect(screen.queryAllByTestId(selectors.components.DataSource.Prometheus.exemplarMarker)).toHaveLength(2);
      });
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

    it('does not render exemplar fields with null values', async () => {
      const frame = createDataFrame({
        name: 'exemplars',
        fields: [
          { name: 'Time', values: [1670418750000] },
          { name: 'Value', values: [0.5] },
          { name: 'empty-label', type: FieldType.string, values: [null] },
          { name: 'populated-label', type: FieldType.string, values: ['value'] },
        ],
      });

      setUp({ exemplars: [frame] });
      await userEvent.click(getMarker());

      expect(screen.queryByText('empty-label')).not.toBeInTheDocument();
      expect(screen.getByText('populated-label')).toBeVisible();
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

    it.each(['click', 'hover'])('does not render link action fields without values on %s', async (userAction) => {
      setUp();
      //@ts-expect-error
      await userEvent[userAction](getMarker());

      expect(screen.queryByText('Field Action')).not.toBeInTheDocument();
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
