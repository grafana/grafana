import React, { useMemo } from 'react';
import { PanelProps, DataFrame, buildHistogram, getHistogramFields, HistogramFields } from '@grafana/data';

import { Histogram } from './Histogram';
import { PanelOptions } from './models.gen';
import { useTheme2 } from '@grafana/ui';

type Props = PanelProps<PanelOptions>;

export const HistogramPanel: React.FC<Props> = ({ data, options, width, height }) => {
  const theme = useTheme2();

  const histogram = useMemo(() => {
    if (!data?.series?.length) {
      return undefined;
    }
    if (data.series.length === 1) {
      const info = getHistogramFields(data.series[0]);
      if (info) {
        return toFrame(info);
      }
    }

    return toFrame(buildHistogram(data.series, options.bucketSize, options.bucketOffset));
  }, [data.series, options.bucketSize, options.bucketOffset]);

  if (!histogram || !histogram.fields.length) {
    return (
      <div className="panel-empty">
        <p>No histogram found in response</p>
      </div>
    );
  }

  return (
    <Histogram
      theme={theme}
      legend={null as any}
      structureRev={data.structureRev}
      width={width}
      height={height}
      alignedFrame={histogram}
      //fieldConfig={fieldConfig}
      //onLegendClick={onLegendClick}
      //onSeriesColorChange={onSeriesColorChange}
    />
  );
};

function toFrame(info: HistogramFields): DataFrame {
  return {
    fields: [info.bucketMin, info.bucketMax, ...info.counts],
    length: info.bucketMin.values.length,
  };
}
