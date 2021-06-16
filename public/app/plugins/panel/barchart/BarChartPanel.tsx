import React, { useMemo } from 'react';
import { PanelProps, TimeRange, VizOrientation } from '@grafana/data';
import { TooltipPlugin } from '@grafana/ui';
import { BarChartOptions } from './types';
import { BarChart } from './BarChart';
import { prepareGraphableFrames } from './utils';

interface Props extends PanelProps<BarChartOptions> {}

/**
 * @alpha
 */
export const BarChartPanel: React.FunctionComponent<Props> = ({ data, options, width, height, timeZone }) => {
  const { frames, warn } = useMemo(() => prepareGraphableFrames(data?.series), [data]);
  const orientation = useMemo(() => {
    if (!options.orientation || options.orientation === VizOrientation.Auto) {
      return width < height ? VizOrientation.Horizontal : VizOrientation.Vertical;
    }

    return options.orientation;
  }, [width, height, options.orientation]);

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  return (
    <BarChart
      frames={frames}
      timeZone={timeZone}
      timeRange={({ from: 1, to: 1 } as unknown) as TimeRange} // HACK
      structureRev={data.structureRev}
      width={width}
      height={height}
      {...options}
      orientation={orientation}
    >
      {(config, alignedFrame) => {
        return <TooltipPlugin data={alignedFrame} config={config} mode={options.tooltip.mode} timeZone={timeZone} />;
      }}
    </BarChart>
  );
};
