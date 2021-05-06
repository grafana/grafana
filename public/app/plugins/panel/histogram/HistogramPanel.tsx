import React, { useMemo } from 'react';
import {
  PanelProps,
  HistogramTransformerOptions,
  DataFrame,
  buildHistogram,
  getHistogramFields,
  HistogramFields,
} from '@grafana/data';

import { Histogram } from '@grafana/ui';

interface HistogramPanelOptions extends HistogramTransformerOptions {
  // anything else?
}

type Props = PanelProps<HistogramPanelOptions>;

export const HistogramPanel: React.FC<Props> = ({ data, options, width, height }) => {
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

    return toFrame(buildHistogram(data.series, options.bucketSize));
  }, [data.series, options.bucketSize]);

  if (!histogram || !histogram.fields.length) {
    return (
      <div className="panel-empty">
        <p>No histogram found in response</p>
      </div>
    );
  }

  return (
    <Histogram
      structureRev={data.structureRev}
      width={width}
      height={height}
      frames={[histogram]}
      bucketSize={0} // not really used
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
