import React, { useLayoutEffect, useRef } from 'react';
import uPlot from 'uplot';

import { AbsoluteTimeRange } from '@grafana/data';
import { UPlotConfigBuilder, Button } from '@grafana/ui';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

export const OutsideRangePlugin: React.FC<ThresholdControlsPluginProps> = ({ config, onChangeTimeRange }) => {
  const plotInstance = useRef<uPlot>();

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });
  }, [config]);

  const timevalues = plotInstance.current?.data?.[0];
  if (!timevalues || !plotInstance.current || timevalues.length < 2 || !onChangeTimeRange) {
    return null;
  }

  const scale = plotInstance.current.scales['x'];
  if (!scale || !scale.time || !scale.min || !scale.max!) {
    return null;
  }

  // Time values are always sorted for uPlot to work
  const first = timevalues[0];
  const last = timevalues[timevalues.length - 1];
  const fromX = scale.min;
  const toX = scale.max;

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
