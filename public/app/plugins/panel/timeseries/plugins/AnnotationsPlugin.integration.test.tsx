import { render, screen, waitFor } from '@testing-library/react';

import {
  applyFieldOverrides,
  createDataFrame,
  createFieldConfigRegistry,
  createTheme,
  type DataFrame,
  DataTopic,
  dateTime,
  FieldType,
  LoadingState,
  type TimeRange,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../../test-utils';
import { TimeSeriesPanel } from '../TimeSeriesPanel';
import { defaultGraphConfig, getGraphFieldConfig } from '../config';
import { type Options } from '../panelcfg.gen';

/**
 * Unlike AnnotationsPlugin.test.tsx, which mocks uPlot, these tests render the real TimeSeriesPanel -> GraphNG ->
 * UPlotChart -> uPlot stack. Real uPlot copies its hooks when the plot is constructed, so a hook the plugin
 * registers afterwards never fires.
 */

const T10 = Date.UTC(2025, 9, 2, 10);
const T11 = Date.UTC(2025, 9, 2, 11);
const T06 = Date.UTC(2025, 9, 2, 6);
// 07:00, 07:12, 07:24, 07:36, 07:48 — inside 06:00-11:00, outside 10:00-11:00
const ANNOTATION_TIMES = Array.from({ length: 5 }, (_, i) => Date.UTC(2025, 9, 2, 7) + i * 12 * 60 * 1000);

const theme = createTheme();
const fieldConfigRegistry = createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Time series');
const fieldConfig = { defaults: { custom: defaultGraphConfig }, overrides: [] };
const options: Options = {
  legend: { showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
  tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None },
};

function createSeries(from: number, to: number): DataFrame[] {
  const frame = createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [from, (from + to) / 2, to] },
      { name: 'value', type: FieldType.number, values: [1, 2, 3] },
    ],
  });
  return applyFieldOverrides({
    data: [frame],
    fieldConfig,
    replaceVariables: (v) => v,
    theme,
    fieldConfigRegistry,
    timeZone: 'utc',
  });
}

function createAnnotations(times: number[]): DataFrame[] {
  return [
    createDataFrame({
      name: 'annotations',
      meta: { dataTopic: DataTopic.Annotations },
      fields: [
        { name: 'time', type: FieldType.time, values: times },
        { name: 'text', type: FieldType.string, values: times.map((_, i) => `annotation ${i}`) },
      ],
    }),
  ];
}

function createTimeRange(from: number, to: number): TimeRange {
  return { from: dateTime(from), to: dateTime(to), raw: { from: dateTime(from), to: dateTime(to) } };
}

function panel({
  series,
  annotations,
  timeRange,
  structureRev = 1,
}: {
  series: DataFrame[];
  annotations: DataFrame[];
  timeRange: TimeRange;
  structureRev?: number;
}) {
  const props = getPanelProps<Options>(options, {
    // A constant structureRev keeps GraphNG on the same config builder (and so the same uPlot instance) across
    // rerenders, the way a dashboard keeps it when only the data values or time range change.
    data: { state: LoadingState.Done, series, annotations, timeRange, structureRev },
    timeRange,
    fieldConfig,
    replaceVariables: (v) => v,
    width: 648,
    height: 378,
  });
  return <TimeSeriesPanel {...props} />;
}

const getMarkers = () => screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
const getMarkerLefts = () => getMarkers().map((marker) => marker.style.left);

// Waits for uPlot's first commit (and its `ready` hook) so the next rerender lands on a ready plot.
async function waitForPlotReady() {
  await waitFor(() => expect(document.querySelector('.u-axis')).toBeInTheDocument());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AnnotationsPlugin with a real uPlot instance', () => {
  beforeEach(() => {
    // jsdom has no layout; AnnotationsPlugin hides markers positioned outside uPlot's `rect.width`.
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: 600,
      height: 300,
      right: 600,
      bottom: 300,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a marker for each annotation present when the panel first renders', async () => {
    render(
      panel({
        series: createSeries(T06, T11),
        annotations: createAnnotations(ANNOTATION_TIMES),
        timeRange: createTimeRange(T06, T11),
      })
    );

    await waitFor(() => expect(getMarkers()).toHaveLength(5));
  });

  it('renders markers for annotations that arrive after the plot is constructed but before it is ready', async () => {
    const series = createSeries(T06, T11);
    const timeRange = createTimeRange(T06, T11);
    const { rerender } = render(panel({ series, annotations: [], timeRange }));

    // Synchronous: uPlot fires `ready` in a microtask, so this render lands before it.
    rerender(panel({ series, annotations: createAnnotations(ANNOTATION_TIMES), timeRange }));

    await waitFor(() => expect(getMarkers()).toHaveLength(5));
  });

  it('renders markers after the time range changes from a range without annotations to one with them', async () => {
    const { rerender } = render(
      panel({ series: createSeries(T10, T11), annotations: [], timeRange: createTimeRange(T10, T11) })
    );
    await waitForPlotReady();

    rerender(
      panel({
        series: createSeries(T06, T11),
        annotations: createAnnotations(ANNOTATION_TIMES),
        timeRange: createTimeRange(T06, T11),
      })
    );

    await waitFor(() => expect(getMarkers()).toHaveLength(5));
  });

  it('renders markers for annotations that arrive after the plot is ready', async () => {
    const series = createSeries(T06, T11);
    const timeRange = createTimeRange(T06, T11);
    const { rerender } = render(panel({ series, annotations: [], timeRange }));
    await waitForPlotReady();

    rerender(panel({ series, annotations: createAnnotations(ANNOTATION_TIMES), timeRange }));

    await waitFor(() => expect(getMarkers()).toHaveLength(5));
  });

  it('moves markers when the same number of annotations arrive at different times', async () => {
    const series = createSeries(T06, T11);
    const timeRange = createTimeRange(T06, T11);
    const { rerender } = render(panel({ series, annotations: createAnnotations(ANNOTATION_TIMES), timeRange }));
    await waitFor(() => expect(getMarkers()).toHaveLength(5));
    const initialLefts = getMarkerLefts();

    const shiftedTimes = ANNOTATION_TIMES.map((time) => time + 6 * 60 * 1000);
    rerender(panel({ series, annotations: createAnnotations(shiftedTimes), timeRange }));

    await waitFor(() => {
      const lefts = getMarkerLefts();
      expect(lefts).toHaveLength(5);
      lefts.forEach((left, i) => expect(left).not.toBe(initialLefts[i]));
    });
  });

  it('removes markers when the annotations are cleared', async () => {
    const series = createSeries(T06, T11);
    const timeRange = createTimeRange(T06, T11);
    const { rerender } = render(panel({ series, annotations: createAnnotations(ANNOTATION_TIMES), timeRange }));
    await waitFor(() => expect(getMarkers()).toHaveLength(5));

    rerender(panel({ series, annotations: [], timeRange }));

    await waitFor(() => expect(getMarkers()).toHaveLength(0));
  });

  it('stops rendering markers outside the range on zoom in, and renders them again on zoom out', async () => {
    const annotations = createAnnotations(ANNOTATION_TIMES);
    const { rerender } = render(
      panel({ series: createSeries(T06, T11), annotations, timeRange: createTimeRange(T06, T11) })
    );
    await waitFor(() => expect(getMarkers()).toHaveLength(5));

    rerender(panel({ series: createSeries(T10, T11), annotations, timeRange: createTimeRange(T10, T11) }));
    await waitFor(() => expect(getMarkers()).toHaveLength(0));

    rerender(panel({ series: createSeries(T06, T11), annotations, timeRange: createTimeRange(T06, T11) }));
    await waitFor(() => expect(getMarkers()).toHaveLength(5));
  });

  it('renders markers after a new config rebuilds the plot', async () => {
    const timeRange = createTimeRange(T06, T11);
    const annotations = createAnnotations(ANNOTATION_TIMES);
    const { rerender } = render(panel({ series: createSeries(T06, T11), annotations, timeRange, structureRev: 1 }));
    await waitFor(() => expect(getMarkers()).toHaveLength(5));
    const firstAxis = document.querySelector('.u-axis');

    // GraphNG only checks structureRev when the frames change, so a structure change needs new series too.
    rerender(panel({ series: createSeries(T06, T11), annotations, timeRange, structureRev: 2 }));

    await waitFor(() => expect(document.querySelector('.u-axis')).not.toBe(firstAxis));
    await waitFor(() => expect(getMarkers()).toHaveLength(5));
  });
});
