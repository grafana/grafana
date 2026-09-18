import { render, screen } from '@testing-library/react';

import { type DataFrame, type DisplayProcessor, FieldColorModeId, FieldType, createDataFrame } from '@grafana/data';
import { SortOrder, TimeCompareColorMode, TooltipDisplayMode } from '@grafana/schema';

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
  valueFields.forEach(({ displayName }, i) => {
    frame.fields[i + 1].display = numberDisplay;
    frame.fields[i + 1].state = { displayName };
  });

  return frame;
}

describe('TimeSeriesTooltip time comparison', () => {
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
        timeCompare={{ diffMs: [0, -ONE_DAY_MS] }}
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
        timeCompare={{ diffMs: [0, -ONE_DAY_MS] }}
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
        timeCompare={{ diffMs: [0, 0] }}
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
        timeCompare={{ diffMs: [0, 0, -ONE_DAY_MS] }}
      />
    );

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('CPU (comparison)')).toBeInTheDocument();
  });
});

describe('TimeSeriesTooltip comparison pairing', () => {
  // aligned field indices: 0 is the x field, 1 the current series, 2 its compare counterpart
  const CURRENT_IDX = 1;
  const COMPARE_IDX = 2;
  const PAIRS = new Map([
    [CURRENT_IDX, COMPARE_IDX],
    [COMPARE_IDX, CURRENT_IDX],
  ]);

  function renderPair({
    seriesIdx,
    mode = TooltipDisplayMode.Single,
    pairs = PAIRS,
    deltaColorMode,
  }: {
    seriesIdx: number | null;
    mode?: TooltipDisplayMode;
    pairs?: Map<number, number>;
    deltaColorMode?: TimeCompareColorMode;
  }) {
    render(
      <TimeSeriesTooltip
        series={makeSeries(
          { displayName: 'CPU', value: 20 },
          { displayName: 'CPU (comparison)', dashed: true, value: 25 }
        )}
        dataIdxs={[0, 0, 0]}
        seriesIdx={seriesIdx}
        mode={mode}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
        timeCompare={{ diffMs: [0, 0, -ONE_DAY_MS], fieldPairs: pairs, colorMode: deltaColorMode }}
      />
    );
  }

  it('shows the paired compare entry in single mode', () => {
    // Single mode normally renders only the hovered series; a pair coerces it to Multi
    // so the counterpart can be shown alongside.
    renderPair({ seriesIdx: CURRENT_IDX });

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('CPU (comparison)')).toBeInTheDocument();
  });

  it('annotates the compare entry with the delta from the hovered series', () => {
    renderPair({ seriesIdx: CURRENT_IDX });

    // value and delta are separate elements so the delta can be colored independently
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('(+5)')).toBeInTheDocument();
  });

  // Guards the wiring from the panel option down to the delta: the modes themselves are covered
  // in VizTooltipRow. Inverted is used because it flips the default coloring of the same delta.
  it('colors the delta by the configured color mode', () => {
    renderPair({ seriesIdx: CURRENT_IDX, deltaColorMode: TimeCompareColorMode.Inverted });

    // hovering the current series (20) puts a +5 delta on the compare row, which inverted colors
    // with the error color rather than the success color the default mode would use
    expect(screen.getByText('(+5)')).toHaveStyle({ color: '#ff5286' });
  });

  it('shows the paired current entry when hovering the comparison series', () => {
    renderPair({ seriesIdx: COMPARE_IDX });

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('CPU (comparison)')).toBeInTheDocument();
    // hovering compare (25) puts the delta on the current row: 20 - 25
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('(-5)')).toBeInTheDocument();
  });

  it('falls back to single-series behavior when the hovered series has no counterpart', () => {
    renderPair({ seriesIdx: CURRENT_IDX, pairs: new Map() });

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.queryByText('CPU (comparison)')).not.toBeInTheDocument();
  });

  it('shows all series in multi mode, even series unrelated to a comparison', () => {
    render(
      <TimeSeriesTooltip
        series={makeSeries(
          { displayName: 'CPU', value: 20 },
          { displayName: 'CPU (comparison)', dashed: true, value: 25 },
          { displayName: 'Memory', value: 99 }
        )}
        dataIdxs={[0, 0, 0, 0]}
        seriesIdx={CURRENT_IDX}
        mode={TooltipDisplayMode.Multi}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
        timeCompare={{ diffMs: [0, 0, -ONE_DAY_MS, 0], fieldPairs: PAIRS }}
      />
    );

    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('CPU (comparison)')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();

    // Showing every series does not spread the delta around: only the hovered series'
    // counterpart is annotated, and an unrelated series keeps its plain value.
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('(+5)')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
    // the unrelated series carries no delta at all
    expect(screen.queryByText('(+79)')).not.toBeInTheDocument();
  });
});
