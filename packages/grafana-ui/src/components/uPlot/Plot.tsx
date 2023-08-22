import React, { Component, createRef } from 'react';
import uPlot, { AlignedData, Options } from 'uplot';

import { PlotProps } from './types';
import { pluginLog } from './utils';

function sameDims(prevProps: PlotProps, nextProps: PlotProps) {
  return nextProps.width === prevProps.width && nextProps.height === prevProps.height;
}

function sameData(prevProps: PlotProps, nextProps: PlotProps) {
  return nextProps.data === prevProps.data;
}

function sameConfig(prevProps: PlotProps, nextProps: PlotProps) {
  return nextProps.config === prevProps.config;
}

type UPlotChartState = {
  plot: uPlot | null;
};

/**
 * @internal
 * uPlot abstraction responsible for plot initialisation, setup and refresh
 * Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
 * Exposes context for uPlot instance access
 */
export class UPlotChart extends Component<PlotProps, UPlotChartState> {
  plotContainer = createRef<HTMLDivElement>();
  plotCanvasBBox = createRef<DOMRect>();

  constructor(props: PlotProps) {
    super(props);

    this.state = {
      plot: null,
    };
  }

  reinitPlot() {
    let { width, height, plotRef } = this.props;

    this.state.plot?.destroy();

    if (width === 0 && height === 0) {
      return;
    }

    this.props.config.addHook('setSize', (u) => {
      const canvas = u.over;
      if (!canvas) {
        return;
      }
    });

    const config: Options = {
      width: Math.floor(this.props.width),
      height: Math.floor(this.props.height),
      ...this.props.config.getConfig(),
    };

    pluginLog('UPlot', false, 'Reinitializing plot', config);
    const plot = new uPlot(config, this.props.data as AlignedData, this.plotContainer!.current!);

    if (plotRef) {
      plotRef(plot);
    }

    this.setState({ plot });
  }

  componentDidMount() {
    this.reinitPlot();
  }

  componentWillUnmount() {
    this.state.plot?.destroy();
  }

  componentDidUpdate(prevProps: PlotProps) {
    let { plot } = this.state;

    if (!sameDims(prevProps, this.props)) {
      plot?.setSize({
        width: Math.floor(this.props.width),
        height: Math.floor(this.props.height),
      });
    } else if (!sameConfig(prevProps, this.props)) {
      this.reinitPlot();
    } else if (!sameData(prevProps, this.props)) {
      plot?.setData(this.props.data as AlignedData);
    }
  }

  render() {
    return (
      <div style={{ position: 'relative' }}>
        <div ref={this.plotContainer} data-testid="uplot-main-div" />
        {this.props.children}
      </div>
    );
  }
}
