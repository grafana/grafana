import { encodeImageData } from 'node-stego';
import { Component } from 'react';
import uPlot from 'uplot';

import { DataFrame, TimeRange } from '@grafana/data';
import { withTheme2 } from '@grafana/ui';
import { hasVisibleLegendSeries, PlotLegend, UPlotConfigBuilder } from '@grafana/ui/internal';

import { GraphNG, GraphNGProps, PropDiffFn } from '../GraphNG/GraphNG';

import { preparePlotConfigBuilder } from './utils';

const propsToDiff: Array<string | PropDiffFn> = ['legend', 'options', 'theme'];

type TimeSeriesProps = Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'>;

export class UnthemedTimeSeries extends Component<TimeSeriesProps> {
  prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    const { theme, timeZone, options, renderers, tweakAxis, tweakScale } = this.props;

    const config = preparePlotConfigBuilder({
      frame: alignedFrame,
      theme,
      timeZones: Array.isArray(timeZone) ? timeZone : [timeZone],
      getTimeRange,
      allFrames,
      renderers,
      tweakScale,
      tweakAxis,
      hoverProximity: options?.tooltip?.hoverProximity,
      orientation: options?.orientation,
    });

    // Draw a background color for the plot as the alpha channel is unhelpful
    const drawBackground = (u: uPlot) => {
      const width = u.ctx.canvas.width;
      const height = u.ctx.canvas.height;

      u.ctx.save();
      u.ctx.fillStyle = theme.colors.background.primary;
      u.ctx.fillRect(0, 0, width, height);
      u.ctx.restore();
    };

    config.addHook('drawClear', drawBackground);

    // Get the URL of the current page and strip the domain name - TODO: process from/to arguments like "now-6h" with timestamp
    const url = window.location.href;
    let urlWithoutDomain = url.replace(window.location.origin, '');
    // ensure length not too long to be encoded (currently (64*64 - 8) bits = 4096 bits = 511 bytes)
    const textEncoder = new TextEncoder();
    if (textEncoder.encode(urlWithoutDomain).length > 511) {
      console.log('url too long, need to truncate', urlWithoutDomain);
      urlWithoutDomain = urlWithoutDomain.slice(0, 511);
    }
    console.log('GGGG url', urlWithoutDomain);

    // Post draw test
    config.addHook('draw', (u: uPlot) => {
      const imageData = u.ctx.getImageData(0, 0, u.ctx.canvas.width, u.ctx.canvas.height);
      const data = {
        data: new Uint8Array(imageData.data),
        width: u.ctx.canvas.width,
        height: u.ctx.canvas.height,
      };

      const encoded = encodeImageData(data, urlWithoutDomain);

      // convert to ImageData
      const clampedArray = new Uint8ClampedArray(encoded.data); // TODO need to fix this copy
      const imageData2 = new ImageData(clampedArray, encoded.width, encoded.height);
      u.ctx.putImageData(imageData2, 0, 0);
    });

    return config;
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, frames } = this.props;

    if (!config || (legend && !legend.showLegend) || !hasVisibleLegendSeries(config, frames)) {
      return null;
    }

    return <PlotLegend data={frames} config={config} {...legend} />;
  };

  render() {
    return (
      <GraphNG
        {...this.props}
        prepConfig={this.prepConfig}
        propsToDiff={propsToDiff}
        renderLegend={this.renderLegend}
      />
    );
  }
}

export const TimeSeries = withTheme2(UnthemedTimeSeries);
TimeSeries.displayName = 'TimeSeries';
