import React, { useMemo } from 'react';
import { PanelProps, HistogramTransformerOptions } from '@grafana/data';
import { buildHistogram } from '@grafana/data/src/transformations/transformers/histogram';

interface HistogramPanelOptions extends HistogramTransformerOptions {
  // anything else?
}

type Props = PanelProps<HistogramPanelOptions>;

export const HistogramPanel: React.FC<Props> = ({ data, options, width, height }) => {
  const alignedFrame = useMemo(() => {
    if (!data?.series?.length) {
      return undefined;
    }

    return buildHistogram(data.series, options);
  }, [data.series, options]);

  if (!alignedFrame) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return <div>SHOW HISTOGRAM</div>;
};
