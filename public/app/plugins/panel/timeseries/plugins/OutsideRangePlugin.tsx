import { useLayoutEffect, useState, useCallback, memo } from 'react';
import type uPlot from 'uplot';

import { type AbsoluteTimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { type UPlotConfigBuilder, Button } from '@grafana/ui';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
  /**
   * Set when each value is drawn until the next one, like the state timeline does.
   * The last value then reaches into the time range even if its timestamp is before it.
   */
  holdLastValue?: boolean;
}

export const OutsideRangePlugin = memo(({ config, onChangeTimeRange, holdLastValue }: ThresholdControlsPluginProps) => {
  const [data, setData] = useState<uPlot['data']>([]);
  const [timeRange, setTimeRange] = useState<uPlot['scales']['x']>();

  useLayoutEffect(() => {
    config.addHook('setScale', (u) => {
      setData(u.data ?? []);
      setTimeRange(u.scales['x']);
    });
  }, [config]);

  /**
   * returns true if all non-time series are null at the given index
   */
  const allValuesNullAtIndex = useCallback(
    (idx: number): boolean => {
      for (let seriesIdx = 1; seriesIdx < data.length; seriesIdx++) {
        if (data[seriesIdx][idx] != null) {
          return false;
        }
      }
      return true;
    },
    [data]
  );

  const timeValues = data[0];
  if (!timeValues || timeValues.length < 1 || !onChangeTimeRange) {
    return null;
  }

  if (!timeRange || !timeRange.time || !timeRange.min || !timeRange.max!) {
    return null;
  }

  // Time values are always sorted for uPlot to work
  let i = 0,
    j = timeValues.length - 1;

  while (i <= j && allValuesNullAtIndex(i)) {
    i++;
  }

  while (j >= 0 && allValuesNullAtIndex(j)) {
    j--;
  }

  // never found any non null values
  if (allValuesNullAtIndex(i) || allValuesNullAtIndex(j)) {
    return null;
  }

  let first = timeValues[i];
  let last = timeValues[j];

  const end = holdLastValue ? getHeldValuesEnd(data) : last;

  // (StartA <= EndB) and (EndA >= StartB)
  if (first <= timeRange.max && end >= timeRange.min) {
    return null;
  }

  // if only one point is outside the range, we will use a timerange which
  // is of the same width as the current timerange around the point.
  if (first === last) {
    const delta = timeRange.max - timeRange.min;
    first -= delta / 2;
    last += delta / 2;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <div>
        <div>
          <Trans i18nKey="timeseries.outside-range-plugin.data-outside-time-range">Data outside time range</Trans>
        </div>
        <Button
          onClick={(v) => onChangeTimeRange({ from: first, to: last })}
          variant="secondary"
          data-testid="time-series-zoom-to-data"
        >
          <Trans i18nKey="timeseries.outside-range-plugin.zoom-to-data">Zoom to data</Trans>
        </Button>
      </div>
    </div>
  );
});

OutsideRangePlugin.displayName = 'OutsideRangePlugin';

/**
 * Matches how the timeline draws: in each series an undefined value continues the previous one and a null ends it.
 * Returns the time where the last held value of any series ends, or Infinity if one reaches the edge of the chart.
 */
function getHeldValuesEnd(data: uPlot.AlignedData): number {
  const timeValues = data[0];
  let end = -Infinity;

  for (let seriesIdx = 1; seriesIdx < data.length; seriesIdx++) {
    const values = data[seriesIdx];

    let lastIdx = values.length - 1;
    while (lastIdx >= 0 && values[lastIdx] == null) {
      lastIdx--;
    }
    if (lastIdx < 0) {
      continue;
    }

    let endIdx = lastIdx + 1;
    while (endIdx < values.length && values[endIdx] === undefined) {
      endIdx++;
    }
    if (endIdx >= values.length) {
      return Infinity;
    }

    end = Math.max(end, timeValues[endIdx]);
  }

  return end;
}
