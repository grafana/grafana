import { useLayoutEffect, useState } from 'react';
import uPlot, { TypedArray, Scale } from 'uplot';

import { AbsoluteTimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { UPlotConfigBuilder, Button } from '@grafana/ui';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

export const OutsideRangePlugin = ({ config, onChangeTimeRange }: ThresholdControlsPluginProps) => {
  const [timeValues, setTimeValues] = useState<uPlot['data'][0]>([]);
  const [nonTimeValues, setNonTimeValues] = useState<Array<uPlot['data'][1]>>([]);
  const [timeRange, setTimeRange] = useState<Scale | undefined>();

  useLayoutEffect(() => {
    config.addHook('setScale', (u) => {
      setTimeValues(u.data?.[0] ?? []);
      setNonTimeValues(u.data?.slice(1) ?? []);
      setTimeRange(u.scales['x'] ?? undefined);
    });
  }, [config]);

  if (timeValues.length < 1 || !onChangeTimeRange) {
    return null;
  }

  if (!timeRange || !timeRange.time || !timeRange.min || !timeRange.max!) {
    return null;
  }

  // Time values are always sorted for uPlot to work

  const memoCache: boolean[] = [];
  const isNullAtIndex = (idx: number) => {
    if (memoCache[idx] !== undefined) {
      return memoCache[idx];
    }
    const isNull = nonTimeValues.every((v) => v[idx] == null);
    memoCache[idx] = isNull;
    return isNull;
  };

  let i = 0,
    j = timeValues.length - 1;

  while (i <= j && isNullAtIndex(i)) {
    i++;
  }

  while (j >= 0 && isNullAtIndex(j)) {
    j--;
  }

  // all values are null
  if (isNullAtIndex(i) && isNullAtIndex(j)) {
    return null;
  }

  let first = !isNullAtIndex(i) ? timeValues[i] : timeValues[j];
  let last = !isNullAtIndex(j) ? timeValues[j] : timeValues[i];

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
