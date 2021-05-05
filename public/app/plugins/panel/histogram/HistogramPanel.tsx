//import React, { useCallback, useMemo } from 'react';
import React from 'react';
import { FieldConfig, FieldType, PanelProps } from '@grafana/data';
import { Histogram, HistogramOptions } from '@grafana/ui';

interface HistogramPanelProps extends PanelProps<HistogramOptions> {}

/**
 * @alpha
 */
export const HistogramPanel: React.FC<HistogramPanelProps> = ({
  data,
  options,
  width,
  height,
  //fieldConfig,
  //eventBus,

  //timeRange,
  //timeZone,

  // /** Panel options change handler */
  // onOptionsChange: (options: T) => void;

  // /** Field config change handler */
  // onFieldConfigChange: (config: FieldConfigSource) => void;

  // /** Template variables interpolation function */
  // replaceVariables: InterpolateFunction;

  // /** Time range change handler */
  // onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}) => {
  /*
  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
    },
    [fieldConfig, onFieldConfigChange]
  );
  */

  const {
    //structureRev,
    series: frames,
    //annotations,
    //timeRange
  } = data;

  const { bucketSize } = options;

  if (!data.series.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const firstFrame = data.series[0];

  if (!firstFrame.fields.some((f) => f.type === FieldType.number)) {
    return (
      <div className="panel-empty">
        <p>No numeric fields found</p>
      </div>
    );
  }

  return (
    <Histogram
      width={width}
      height={height}
      frames={frames}
      bucketSize={bucketSize}
      //fieldConfig={fieldConfig}
      //onLegendClick={onLegendClick}
      //onSeriesColorChange={onSeriesColorChange}
    />
  );
};
