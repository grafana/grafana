import { useMemo } from 'react';

import { PanelProps, buildHistogram, cacheFieldDisplayNames, getHistogramFields } from '@grafana/data';
import { histogramFieldsToFrame } from '@grafana/data/src/transformations/transformers/histogram';
import { TooltipDisplayMode, TooltipPlugin2, useTheme2 } from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';

import { Histogram, getBucketSize } from './Histogram';
import { HistogramTooltip } from './HistogramTooltip';
import { Options } from './panelcfg.gen';

type Props = PanelProps<Options>;

export const HistogramPanel = ({ data, options, width, height }: Props) => {
  const theme = useTheme2();

  const histogram = useMemo(() => {
    if (!data.series.length) {
      return undefined;
    }

    // stamp origins for legend's calcs (from raw values)
    data.series.forEach((frame, frameIndex) => {
      frame.fields.forEach((field, fieldIndex) => {
        field.state = {
          ...field.state,
          origin: {
            frameIndex,
            fieldIndex,
          },
        };
      });
    });

    cacheFieldDisplayNames(data.series);

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
      bucketCount={options.bucketCount}
    >
      {(builder, alignedFrame, xMinOnlyFrame) => {
        return (
          <>
            {options.tooltip.mode !== TooltipDisplayMode.None && (
              <TooltipPlugin2
                config={builder}
                hoverMode={
                  options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
                }
                render={(u, dataIdxs, seriesIdx, isPinned = false) => {
                  return (
                    <HistogramTooltip
                      series={histogram}
                      xMinOnlyFrame={xMinOnlyFrame}
                      dataIdxs={dataIdxs}
                      seriesIdx={seriesIdx}
                      mode={options.tooltip.mode}
                      sortOrder={options.tooltip.sort}
                      isPinned={isPinned}
                      maxHeight={options.tooltip.maxHeight}
                    />
                  );
                }}
                maxWidth={options.tooltip.maxWidth}
              />
            )}
          </>
        );
      }}
    </Histogram>
  );
};
