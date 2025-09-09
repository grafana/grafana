import { useMemo } from 'react';

import {
  histogramFieldsToFrame,
  joinHistograms,
  DataFrameType,
  buildHistogram,
  cacheFieldDisplayNames,
  getHistogramFields,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { TooltipDisplayMode, TooltipPlugin2, useTheme2, TooltipHoverMode } from '@grafana/ui';

import { Histogram, getBucketSize } from './Histogram';
import { HistogramTooltip } from './HistogramTooltip';
import { HistogramPanelProps } from './types';

type Props = HistogramPanelProps;

export const HistogramPanel = ({ data, options, fieldConfig, width, height }: Props) => {
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

    if (
      data.series.length === 1 ||
      data.series.every(
        (frame) => frame.meta?.type === DataFrameType.HeatmapCells || frame.meta?.type === DataFrameType.HeatmapRows
      )
    ) {
      const histograms = data.series.map((frame) => getHistogramFields(frame)).filter((hist) => hist != null);

      if (histograms.length) {
        return histogramFieldsToFrame(joinHistograms(histograms), theme);
      }
    }
    const hist = buildHistogram(data.series, options, theme);
    if (!hist) {
      return undefined;
    }

    return histogramFieldsToFrame(hist, theme);
  }, [data.series, options, theme]);

  if (!histogram || !histogram.fields.length) {
    return (
      <div className="panel-empty">
        <p>
          <Trans i18nKey="grafana-histogram.panel.no-data-message">No histogram found in response</Trans>
        </p>
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
