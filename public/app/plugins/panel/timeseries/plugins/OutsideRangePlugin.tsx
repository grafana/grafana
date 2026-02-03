import { useLayoutEffect, useState, useMemo, useRef } from 'react';
import uPlot, { Scale } from 'uplot';

import { AbsoluteTimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { UPlotConfigBuilder, Button } from '@grafana/ui';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

const areAllNonTimeValuesNullAtIndex = (values: Array<uPlot['data'][1]>, idx: number, cache: boolean[]) => {
  if (cache[idx] !== undefined) {
    return cache[idx];
  }
  const isNull = values.every((v) => v[idx] == null);
  cache[idx] = isNull;
  return isNull;
};

export const OutsideRangePlugin = ({ config, onChangeTimeRange }: ThresholdControlsPluginProps) => {
  const [timeValues, setTimeValues] = useState<uPlot['data'][0]>([]);
  const [nonTimeValues, setNonTimeValues] = useState<Array<uPlot['data'][1]>>([]);
  const [timeRange, setTimeRange] = useState<Scale | undefined>();

  // store this as a ref so it can be reset when setScale is called
  const memoCache = useRef<boolean[]>([]);

  useLayoutEffect(() => {
    config.addHook('setScale', (u) => {
      setTimeValues(u.data?.[0] ?? []);
      setNonTimeValues(u.data?.slice(1) ?? []);
      setTimeRange(u.scales['x'] ?? undefined);
      memoCache.current = [];
    });
  }, [config]);

  if (timeValues.length < 1 || !onChangeTimeRange) {
    return null;
  }

  if (!timeRange || !timeRange.time || !timeRange.min || !timeRange.max!) {
    return null;
  }

  // Time values are always sorted for uPlot to work
  let i = 0,
    j = timeValues.length - 1;

  while (i <= j && areAllNonTimeValuesNullAtIndex(nonTimeValues, i, memoCache.current)) {
    i++;
  }

  while (j >= 0 && areAllNonTimeValuesNullAtIndex(nonTimeValues, j, memoCache.current)) {
    j--;
  }

  // never found any non null values
  if (
    areAllNonTimeValuesNullAtIndex(nonTimeValues, i, memoCache.current) ||
    areAllNonTimeValuesNullAtIndex(nonTimeValues, j, memoCache.current)
  ) {
    return null;
  }

  let first = timeValues[i];
  let last = timeValues[j];

  // (StartA <= EndB) and (EndA >= StartB)
  if (first <= timeRange.max && last >= timeRange.min) {
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
};

OutsideRangePlugin.displayName = 'OutsideRangePlugin';
