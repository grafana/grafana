import React, { useMemo } from 'react';

import { PanelProps, buildHistogram, getHistogramFields } from '@grafana/data';
import { histogramFieldsToFrame } from '@grafana/data/src/transformations/transformers/histogram';
import { useTheme2 } from '@grafana/ui';

import { Histogram, getBucketSize } from './Histogram';
import { PanelOptions } from './models.gen';

type Props = PanelProps<PanelOptions>;

export const HistogramPanel = ({ data, options, width, height }: Props) => {
  const theme = useTheme2();

  const histogram = useMemo(() => {
    if (!data?.series?.length) {
      return undefined;
    }
    if (data.series.length === 1) {
      const info = getHistogramFields(data.series[0]);
      if (info) {
        return histogramFieldsToFrame(info);
      }
    }
    const hist = buildHistogram(data.series, options);
    if (!hist) {
      return undefined;
    }

    return histogramFieldsToFrame(hist, theme);
  }, [data.series, options, theme]);

  if (!histogram || !histogram.fields.length) {
    return (
      <div className="panel-empty">
        <p>No histogram found in response</p>
      </div>
    );
  }

  const bucketSize = getBucketSize(histogram);

  return (
    <Histogram
      options={options}
      theme={theme}
      legend={options.legend}
      rawSeries={data.series}
      structureRev={data.structureRev}
      width={width}
      height={height}
      alignedFrame={histogram}
      bucketSize={bucketSize}
    >
      {(config, alignedFrame) => {
        return null; // <TooltipPlugin data={alignedFrame} config={config} mode={options.tooltip.mode} timeZone={timeZone} />;
      }}
    </Histogram>
  );
};
