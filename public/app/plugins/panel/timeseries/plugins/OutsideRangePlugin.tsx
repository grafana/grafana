import React, { useLayoutEffect, useRef, useState } from 'react';
import uPlot, { TypedArray, Scale } from 'uplot';

import { AbsoluteTimeRange } from '@grafana/data';
import { UPlotConfigBuilder, Button } from '@grafana/ui';
import { Trans } from '@grafana/ui/src/utils/i18n';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

export const OutsideRangePlugin = ({ config, onChangeTimeRange }: ThresholdControlsPluginProps) => {
  const plotInstance = useRef<uPlot>();
  const [timevalues, setTimeValues] = useState<number[] | TypedArray>([]);
  const [timeRange, setTimeRange] = useState<Scale | undefined>();

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });

    config.addHook('setScale', (u) => {
      setTimeValues(u.data?.[0] ?? []);
      setTimeRange(u.scales['x'] ?? undefined);
    });
  }, [config]);

  // If we don't have enough time values or if we can't
  // change the time range then we don't display zoom to data
  if (timevalues.length < 2 || !onChangeTimeRange) {
    return null;
  }

  // If we don't have an appropriate time range then we don't know if data is
  // being displayed
  if (!timeRange || !timeRange.time || !timeRange.min || !timeRange.max!) {
    return null;
  }

  // Time values are always sorted for uPlot to work
  let i = 0;
  let j = timevalues.length - 1;

  // Increment i until we get the last non-null value
  for (; i < (timevalues.length - 1) && timevalues[i] == null; i++) {}

  // Decrement j until we get the first non-null-value
  for (; j > i && timevalues[j] == null; j--) {}

  // Grab the first and last time values
  const last = timevalues[i];
  const first = timevalues[j];

  // If we only have null data then there's no data to zoom
  if (first == null || last == null) {
    return null;
  }

  // If the first time is less than or equal to the top of time in the range
  // or the last time is greater than or equal to the bottom of the time range
  // then there is data to be displayed so we return null
  if (first <= timeRange.max || last >= timeRange.min) {
    return null;
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
          <Trans i18nKey="outside-range.data">Data outside of time range</Trans>
        </div>
        <Button
          onClick={(v) => onChangeTimeRange({ from: first, to: last })}
          variant="secondary"
          data-testid="time-series-zoom-to-data"
        >
          <Trans i18nKey="outside-range.zoom">Zoom to data</Trans>
        </Button>
      </div>
    </div>
  );
};

OutsideRangePlugin.displayName = 'OutsideRangePlugin';
