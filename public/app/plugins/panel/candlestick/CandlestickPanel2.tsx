import React, { useMemo } from 'react';
import { PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { TooltipPlugin, useTheme2, ZoomPlugin } from '@grafana/ui';
import { PanelOptions } from './models.gen';
import { CandlestickPlot } from './CandlestickPlot2';
//import { CandleStickMode } from '../types'; // Sticks | Candles
import { prepareCandlestickFields } from './utils';

interface CandlestickPanelProps extends PanelProps<PanelOptions> {}

/**
 * @alpha
 */
export const CandlestickPanel2: React.FC<CandlestickPanelProps> = ({
  data,
  timeRange,
  timeZone,
  options,
  width,
  height,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();

  const { frames, warn } = useMemo(() => prepareCandlestickFields(data?.series, config.theme2, options), [
    data,
    options,
  ]);

  const legendItems = null;

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  // Candlesticks require some space between values
  if (frames[0].length > width / 2) {
    return (
      <div className="panel-empty">
        <p>
          Too many points to visualize properly. <br />
          Update the query to return fewer points. <br />({frames[0].length} points received)
        </p>
      </div>
    );
  }

  return (
    <CandlestickPlot
      theme={theme}
      frames={frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legendItems={legendItems}
      {...options}
    >
      {(config, alignedFrame) => {
        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            <TooltipPlugin data={alignedFrame} config={config} mode={options.tooltip.mode} timeZone={timeZone} />
          </>
        );
      }}
    </CandlestickPlot>
  );
};
