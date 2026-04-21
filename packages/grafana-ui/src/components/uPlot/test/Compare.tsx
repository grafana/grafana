import * as React from 'react';
import type uPlot from 'uplot';

import { UPlotChart } from '../Plot';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';
import { UPlotSeriesBuilder } from '../config/UPlotSeriesBuilder';

interface Props {
  height: number;
  width: number;
}

/**
 * Static site component, DO NOT EVER USE THIS IN GRAFANA
 * @param height
 * @param width
 * @constructor
 */
export const Compare = ({ height, width }: Props) => {
  function getUrlVars(varName: string) {
    const search = new URLSearchParams(window.location.search);
    return search.get(varName);
  }

  const expectedCanvasScript = getUrlVars('expected');
  const actualCanvasScript = getUrlVars('actual');
  const dataUrl = getUrlVars('uPlotData');
  const seriesUrl = getUrlVars('uPlotSeries');

  const uPlotData = dataUrl ? JSON.parse(dataUrl) : undefined;
  const uPlotSeries = seriesUrl ? JSON.parse(seriesUrl) : undefined;

  const actualUPlotInstance: React.RefObject<uPlot | null> = React.createRef();
  const expectedUPlotInstance: React.RefObject<uPlot | null> = React.createRef();

  if (actualUPlotInstance.current) {
    // eslint-disable-next-line no-eval
    eval(actualCanvasScript);
  }

  if (expectedUPlotInstance.current) {
    // eslint-disable-next-line no-eval
    eval(expectedCanvasScript);
  }

  const config = new UPlotConfigBuilder();
  config.addSeries(uPlotSeries);

  return (
    <>
      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
      <button id="overlay">Overlay</button>
      <div className="wrap">
        <div id="expected">
          <UPlotChart
            config={config}
            data={uPlotData}
            width={width}
            height={height}
            plotRef={(u) => (expectedUPlotInstance.current = u)}
          />
        </div>
        <div id="actual">
          <UPlotChart
            config={config}
            data={uPlotData}
            width={width}
            height={height}
            plotRef={(u) => (actualUPlotInstance.current = u)}
          />
        </div>
      </div>
    </>
  );
};
