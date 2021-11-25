import React, { useMemo } from 'react';
import { TooltipDisplayMode, StackingMode } from '@grafana/schema';
import { PanelProps, TimeRange, VizOrientation } from '@grafana/data';
import { measureText, TooltipPlugin, UPLOT_AXIS_FONT_SIZE, useTheme2 } from '@grafana/ui';
import { BarChartOptions } from './types';
import { BarChart } from './BarChart';
import { prepareGraphableFrames } from './utils';

interface Props extends PanelProps<BarChartOptions> {}

/**
 * @alpha
 */
export const BarChartPanel: React.FunctionComponent<Props> = ({ data, options, width, height, timeZone }) => {
  const theme = useTheme2();

  const { frames, warn } = useMemo(() => prepareGraphableFrames(data?.series, theme, options), [data, theme, options]);
  const orientation = useMemo(() => {
    if (!options.orientation || options.orientation === VizOrientation.Auto) {
      return width < height ? VizOrientation.Horizontal : VizOrientation.Vertical;
    }

    return options.orientation;
  }, [width, height, options.orientation]);

  const xTickLabelMaxLength = useMemo(() => {
    // If no max length is set, limit the number of characters to a length where it will use a maximum of half of the height of the viz.
    if (!options.xTickLabelMaxLength) {
      const rotationAngle = options.xTickLabelRotation;
      const textSize = measureText('M', UPLOT_AXIS_FONT_SIZE).width; // M is usually the widest character so let's use that as an aproximation.
      const maxHeightForValues = height / 2;

      return (
        maxHeightForValues /
          (Math.sin(((rotationAngle >= 0 ? rotationAngle : rotationAngle * -1) * Math.PI) / 180) * textSize) -
        3 //Subtract 3 for the "..." added to the end.
      );
    } else {
      return options.xTickLabelMaxLength;
    }
  }, [height, options.xTickLabelRotation, options.xTickLabelMaxLength]);

  // Force 'multi' tooltip setting or stacking mode
  const tooltip = useMemo(() => {
    if (options.stacking === StackingMode.Normal || options.stacking === StackingMode.Percent) {
      return { ...options.tooltip, mode: TooltipDisplayMode.Multi };
    }
    return options.tooltip;
  }, [options.tooltip, options.stacking]);

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
      xTickLabelMaxLength={xTickLabelMaxLength}
    >
      {(config, alignedFrame) => {
        return <TooltipPlugin data={alignedFrame} config={config} mode={tooltip.mode} timeZone={timeZone} />;
      }}
    </BarChart>
  );
};
