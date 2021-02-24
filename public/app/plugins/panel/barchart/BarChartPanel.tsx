import React, { useCallback, useMemo } from 'react';
import { FieldType, PanelProps, VizOrientation } from '@grafana/data';
import { BarChart, BarChartOptions, GraphNGLegendEvent } from '@grafana/ui';
import { changeSeriesColorConfigFactory } from '../timeseries/overrides/colorSeriesConfigFactory';
import { hideSeriesConfigFactory } from '../timeseries/overrides/hideSeriesConfigFactory';

interface Props extends PanelProps<BarChartOptions> {}

/**
 * @alpha
 */
export const BarChartPanel: React.FunctionComponent<Props> = ({
  data,
  options,
  width,
  height,
  fieldConfig,
  onFieldConfigChange,
}) => {
  const orientation = useMemo(() => {
    if (!options.orientation || options.orientation === VizOrientation.Auto) {
      return width < height ? VizOrientation.Horizontal : VizOrientation.Vertical;
    }

    return options.orientation;
  }, [width, height, options.orientation]);

  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, data.series));
    },
    [fieldConfig, onFieldConfigChange, data.series]
  );

  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
    },
    [fieldConfig, onFieldConfigChange]
  );

  if (!data || !data.series?.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const firstFrame = data.series[0];
  if (!firstFrame.fields.find((f) => f.type === FieldType.string)) {
    return (
      <div className="panel-empty">
        <p>Bar charts requires a string field</p>
      </div>
    );
  }
  if (
    firstFrame.fields.reduce((acc, f) => {
      if (f.type === FieldType.number) {
        return acc + 1;
      }
      return acc;
    }, 0) < 2
  ) {
    return (
      <div className="panel-empty">
        <p>No numeric fields found</p>
      </div>
    );
  }

  return (
    <BarChart
      data={data.series}
      width={width}
      height={height}
      onLegendClick={onLegendClick}
      onSeriesColorChange={onSeriesColorChange}
      {...options}
      orientation={orientation}
    />
  );
};
