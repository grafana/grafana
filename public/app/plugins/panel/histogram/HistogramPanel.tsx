import React, { useMemo } from 'react';
import { PanelProps, buildHistogram, getHistogramFields, applyFieldOverrides } from '@grafana/data';

import { Histogram } from './Histogram';
import { PanelOptions } from './models.gen';
import { TooltipPlugin, useTheme2 } from '@grafana/ui';

type Props = PanelProps<PanelOptions>;

import { histogramFieldsToFrame } from '@grafana/data/src/transformations/transformers/histogram';

export const HistogramPanel: React.FC<Props> = ({
  data,
  options,
  width,
  height,
  timeZone,
  fieldConfig,
  replaceVariables,
}) => {
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

    // This will manage legend/tooltip color and visibility changes
    const frame = histogramFieldsToFrame(hist);
    return applyFieldOverrides({
      data: [frame], // the frame
      fieldConfig, // defaults + overrides
      replaceVariables,
      theme: theme,
    })[0];
  }, [data.series, options, fieldConfig, replaceVariables, theme]);

  if (!histogram || !histogram.fields.length) {
    return (
      <div className="panel-empty">
        <p>No histogram found in response</p>
      </div>
    );
  }

  return (
    <Histogram
      options={options}
      theme={theme}
      legend={options.legend}
      structureRev={data.structureRev}
      width={width}
      height={height}
      alignedFrame={histogram}
    >
      {(config, alignedFrame) => {
        return <TooltipPlugin data={alignedFrame} config={config} mode={options.tooltip.mode} timeZone={timeZone} />;
      }}
    </Histogram>
  );
};
