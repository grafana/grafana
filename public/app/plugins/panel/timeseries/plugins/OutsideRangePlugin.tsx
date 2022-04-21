import React, { useLayoutEffect, useRef } from 'react';
import { TimeRange, AbsoluteTimeRange } from '@grafana/data';
import { UPlotConfigBuilder, Button } from '@grafana/ui';
import uPlot from 'uplot';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  range: TimeRange;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

export const OutsideRangePlugin: React.FC<ThresholdControlsPluginProps> = ({ config, range, onChangeTimeRange }) => {
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

  // Time values are always sorted for uPlot to work
  const first = timevalues[0];
  const last = timevalues[timevalues.length - 1];
  const fromX = range.from.valueOf();
  const toX = range.to.valueOf();

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
