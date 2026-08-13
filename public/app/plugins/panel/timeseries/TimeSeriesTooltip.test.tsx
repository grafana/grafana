import { render, screen } from '@testing-library/react';

import {
  type DataFrame,
  type DisplayProcessor,
  type Field,
  FieldColorModeId,
  FieldType,
  createDataFrame,
} from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { TimeSeriesTooltip } from './TimeSeriesTooltip';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ALIGNED_TIME = 2 * ONE_DAY_MS;

// Deterministic display processors so the header/content text is predictable across timezones — the real
// time processor would format ALIGNED_TIME into a locale/zone-dependent date string.
const timeDisplay: DisplayProcessor = (v) => ({ text: `T${v}`, numeric: Number(v) });
const numberDisplay: DisplayProcessor = (v) => ({ text: `${v}`, numeric: Number(v), color: 'red' });

const DASH_LINE_STYLE = { fill: 'dash', dash: [1, 5, 4, 5] };

interface ValueFieldOpts {
  displayName: string;
  dashed?: boolean;
  value?: number;
  /**
   * Palette index assigned by setClassicPaletteIdxs. A current series and its compare counterpart
   * share one, which is how getComparePartnerIdxs pairs them.
   */
  seriesIndex?: number;
}

// Builds an aligned series frame like the one the panel hands to the tooltip: the compare series' time
// values have already been shifted forward onto the current window, so the tooltip must shift them back.
function makeSeries(...valueFields: ValueFieldOpts[]): DataFrame {
  const frame = createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [ALIGNED_TIME] },
      ...valueFields.map(({ dashed, value = 10 }, i) => ({
        name: `value${i}`,
        type: FieldType.number,
        values: [value],
        config: {
          color: { mode: FieldColorModeId.Fixed, fixedColor: 'red' },
          custom: dashed ? { lineStyle: DASH_LINE_STYLE } : {},
        },
      })),
    ],
  });

  frame.fields[0].display = timeDisplay;
  valueFields.forEach(({ displayName, seriesIndex }, i) => {
    frame.fields[i + 1].display = numberDisplay;
    frame.fields[i + 1].state = { displayName, seriesIndex };
  });

  return frame;
}

/** Pairs the two value fields of a two-series frame (field indices 1 and 2). */
const PAIRED = new Map([
  [1, 2],
  [2, 1],
]);

describe('TimeSeriesTooltip time comparison (#126189)', () => {
  it('shows the (comparison) suffix for a compare series entry', () => {
    render(
      <TimeSeriesTooltip
        series={makeSeries({ displayName: 'CPU (comparison)', dashed: true })}
        dataIdxs={[0, 0]}
        seriesIdx={1}
        mode={TooltipDisplayMode.Single}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
        compareDiffMs={[0, -ONE_DAY_MS]}
      />
    );

    expect(screen.getByText('CPU (comparison)')).toBeInTheDocument();
  });

  it('shifts the header timestamp back to the compare period', () => {
    render(
      <TimeSeriesTooltip
        series={makeSeries({ displayName: 'CPU (comparison)', dashed: true })}
        dataIdxs={[0, 0]}
        seriesIdx={1}
        mode={TooltipDisplayMode.Single}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
        compareDiffMs={[0, -ONE_DAY_MS]}
      />
    );

    // Aligned time sits on the current window; the negative diff shifts it back one day to the compare period.
    expect(screen.getByText(`T${ALIGNED_TIME - ONE_DAY_MS}`)).toBeInTheDocument();
  });

  it('does not shift the header timestamp for the current-period series', () => {
    render(
      <TimeSeriesTooltip
        series={makeSeries({ displayName: 'CPU' })}
        dataIdxs={[0, 0]}
        seriesIdx={1}
        mode={TooltipDisplayMode.Single}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
        compareDiffMs={[0, 0]}
      />
    );

    expect(screen.getByText(`T${ALIGNED_TIME}`)).toBeInTheDocument();
  });

  it('lists both the current and compare entries in multi mode', () => {
    render(
      <TimeSeriesTooltip
        series={makeSeries({ displayName: 'CPU' }, { displayName: 'CPU (comparison)', dashed: true })}
        dataIdxs={[0, 0, 0]}
        seriesIdx={null}
        mode={TooltipDisplayMode.Multi}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
        compareDiffMs={[0, 0, -ONE_DAY_MS]}
      />
    );

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('CPU (comparison)')).toBeInTheDocument();
  });
});

describe('TimeSeriesTooltip compare series pairing (#113575)', () => {
  // A matched pair: current period at field 1, its comparison at field 2, sharing seriesIndex 0.
  const pairedSeries = (currentVal = 39, compareVal = 49) =>
    makeSeries(
      { displayName: 'CPU', seriesIndex: 0, value: currentVal },
      { displayName: 'CPU (comparison)', dashed: true, seriesIndex: 0, value: compareVal }
    );

  const renderPaired = (props: Partial<React.ComponentProps<typeof TimeSeriesTooltip>> = {}) =>
    render(
      <TimeSeriesTooltip
        series={pairedSeries()}
        dataIdxs={[0, 0, 0]}
        seriesIdx={1}
        mode={TooltipDisplayMode.Single}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
        compareDiffMs={[0, 0, -ONE_DAY_MS]}
        comparePartners={PAIRED}
        {...props}
      />
    );

  it('shows the compare row alongside the current row when hovering the current series in single mode', () => {
    renderPaired({ seriesIdx: 1 });

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('CPU (comparison)')).toBeInTheDocument();
  });

  it('shows the current row alongside the compare row when hovering the compare series in single mode', () => {
    renderPaired({ seriesIdx: 2 });

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('CPU (comparison)')).toBeInTheDocument();
  });

  it('annotates the compare row with how far it sits above the current period', () => {
    // 39 now vs 49 a day ago: the comparison is 10 higher, so +10 (+25.6% of the current value).
    renderPaired();

    expect(screen.getByText('49 (+10, +25.6%)')).toBeInTheDocument();
  });

  it('leaves the current row value unannotated so it still reads as a plain value', () => {
    renderPaired();

    expect(screen.getByText('39')).toBeInTheDocument();
  });

  it('shows a negative delta when the comparison sits below the current period', () => {
    renderPaired({ series: pairedSeries(100, 80) });

    expect(screen.getByText('80 (\u221220, \u221220%)')).toBeInTheDocument();
  });

  it('omits the percentage when the current value is zero', () => {
    renderPaired({ series: pairedSeries(0, 50) });

    expect(screen.getByText('50 (+50)')).toBeInTheDocument();
  });

  it('annotates the compare row in multi mode too', () => {
    renderPaired({ mode: TooltipDisplayMode.Multi, seriesIdx: null });

    expect(screen.getByText('39')).toBeInTheDocument();
    expect(screen.getByText('49 (+10, +25.6%)')).toBeInTheDocument();
  });

  it('shows only the hovered series in single mode when it has no compare counterpart', () => {
    render(
      <TimeSeriesTooltip
        series={makeSeries({ displayName: 'CPU', seriesIndex: 0 }, { displayName: 'Memory', seriesIndex: 1 })}
        dataIdxs={[0, 0, 0]}
        seriesIdx={1}
        mode={TooltipDisplayMode.Single}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
        compareDiffMs={[0, 0, 0]}
        comparePartners={new Map()}
      />
    );

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.queryByText('Memory')).not.toBeInTheDocument();
  });

  it('places the compare row directly below the hovered row, ahead of extra fields', () => {
    const extra: Field = {
      name: 'trace_id',
      type: FieldType.string,
      values: ['abc'],
      config: {},
      state: { displayName: 'trace_id' },
      display: (v) => ({ text: String(v), numeric: NaN }),
    };

    renderPaired({ _rest: [extra] });

    const labels = screen.getAllByText(/^(CPU|CPU \(comparison\)|trace_id)$/).map((el) => el.textContent);
    expect(labels).toEqual(['CPU', 'CPU (comparison)', 'trace_id']);
  });

  it('omits the delta when the paired series has no value at the hovered point', () => {
    // A null dataIdx means the current series has no sample here, so no delta can be claimed.
    renderPaired({ dataIdxs: [0, null, 0] });

    expect(screen.getByText('49')).toBeInTheDocument();
  });
});
