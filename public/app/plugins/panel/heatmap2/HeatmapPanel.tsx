import React, { useMemo } from 'react';
import { PanelProps, buildHistogram, getHistogramFields } from '@grafana/data';

import { PanelOptions } from './models.gen';
import { useTheme2 } from '@grafana/ui';

type Props = PanelProps<PanelOptions>;

import { histogramFieldsToFrame } from '@grafana/data/src/transformations/transformers/histogram';

export const HeatmapPanel: React.FC<Props> = ({ data, options, width, height }) => {
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

  return (
    <div>
      TODO... import heatmap panel
      <hr />
      {width}x {height}
    </div>
  );
};
