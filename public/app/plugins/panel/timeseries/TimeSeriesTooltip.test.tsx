import { render, screen } from '@testing-library/react';

import { type DataFrame, type DisplayProcessor, FieldColorModeId, FieldType, createDataFrame } from '@grafana/data';
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
}

// Builds an aligned series frame like the one the panel hands to the tooltip: the compare series' time
// values have already been shifted forward onto the current window, so the tooltip must shift them back.
function makeSeries(...valueFields: ValueFieldOpts[]): DataFrame {
  const frame = createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [ALIGNED_TIME] },
      ...valueFields.map(({ dashed }, i) => ({
        name: `value${i}`,
        type: FieldType.number,
        values: [10],
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

  it('still renders the header timestamp when the first series is hidden (#109913)', () => {
    // makeSeries with two value fields builds a 3-field frame: [time, CPU, Memory].
    // dataIdxs is per-field; a null entry means that field has no hovered value.
    // When the time/x field (index 0) and the first value series (index 1) have no
    // hovered value but the second series (index 2) does, the header timestamp must
    // still be derived from the remaining non-null dataIdx.
    render(
      <TimeSeriesTooltip
        series={makeSeries({ displayName: 'CPU' }, { displayName: 'Memory' })}
        dataIdxs={[null, null, 0]}
        seriesIdx={2}
        mode={TooltipDisplayMode.Multi}
        sortOrder={SortOrder.None}
        isPinned={false}
        dataLinks={[]}
      />
    );

    expect(screen.getByText(`T${ALIGNED_TIME}`)).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
  });
});
