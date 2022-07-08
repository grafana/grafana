import React, { useLayoutEffect, useRef, useState } from 'react';
import uPlot, { Scale } from 'uplot';

import { AbsoluteTimeRange } from '@grafana/data';
import { UPlotConfigBuilder, Button } from '@grafana/ui';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

export const OutsideRangePlugin: React.FC<ThresholdControlsPluginProps> = ({ config, onChangeTimeRange }) => {
  const plotInstance = useRef<uPlot>();
  const [timevalues, setTimeValues] = useState<number[]>([]);
  const [timeRange, setTimeRange] = useState<Scale | undefined>();

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });

    config.addHook('setScale', (u) => {
      setTimeValues((u.data?.[0] as number[]) ?? []);
      setTimeRange(u.scales['x'] ?? undefined);
    });
  }, [config]);

  if (timevalues.length < 2 || !onChangeTimeRange) {
    return null;
  }

  if (!timeRange || !timeRange.time || !timeRange.min || !timeRange.max!) {
    return null;
  }

  // Time values are always sorted for uPlot to work
  const first = timevalues[0];
  const last = timevalues[timevalues.length - 1];
  const fromX = timeRange.min;
  const toX = timeRange.max;

  // (StartA <= EndB) and (EndA >= StartB)
  if (first <= toX && last >= fromX) {
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
        <div>Data outside time range</div>
        <Button onClick={(v) => onChangeTimeRange({ from: first, to: last })} variant="secondary">
          Zoom to data
        </Button>
      </div>
    </div>
  );
};

OutsideRangePlugin.displayName = 'OutsideRangePlugin';
