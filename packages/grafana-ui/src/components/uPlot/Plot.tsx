import React, { createRef } from 'react';
import uPlot, { Options } from 'uplot';
import { PlotContext, PlotContextType } from './context';
import { DEFAULT_PLOT_CONFIG } from './utils';
import { PlotProps } from './types';

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
  ctx: PlotContextType;
};

/**
 * @internal
 * uPlot abstraction responsible for plot initialisation, setup and refresh
 * Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
 * Exposes context for uPlot instance access
 */
export class UPlotChart extends React.Component<PlotProps, UPlotChartState> {
  plotContainer = createRef<HTMLDivElement>();

  constructor(props: PlotProps) {
    super(props);

    this.state = {
      ctx: {
        plot: null,
      },
    };
  }

  reinitPlot() {
    let { ctx } = this.state;

    ctx.plot?.destroy();

    let { width, height } = this.props;

    if (width === 0 && height === 0) {
      return;
    }

    const config: Options = {
      ...DEFAULT_PLOT_CONFIG,
      width: this.props.width,
      height: this.props.height,
      ms: 1 as 1,
      ...this.props.config.getConfig(),
    };

    this.setState({
      ctx: {
        plot: new uPlot(config, this.props.data, this.plotContainer!.current!),
      },
    });
  }

  componentDidMount() {
    this.reinitPlot();
  }

  componentWillUnmount() {
    this.state.ctx.plot?.destroy();
  }

  shouldComponentUpdate(nextProps: PlotProps, nextState: UPlotChartState) {
    return (
      nextState.ctx !== this.state.ctx ||
      !sameDims(this.props, nextProps) ||
      !sameData(this.props, nextProps) ||
      !sameConfig(this.props, nextProps)
    );
  }

  componentDidUpdate(prevProps: PlotProps, prevState: object) {
    let { ctx } = this.state;

    if (!sameDims(prevProps, this.props)) {
      ctx.plot?.setSize({
        width: this.props.width,
        height: this.props.height,
      });
    } else if (!sameConfig(prevProps, this.props)) {
      this.reinitPlot();
    } else if (!sameData(prevProps, this.props)) {
      ctx.plot?.setData(this.props.data);
    }
  }

  render() {
    return (
      <PlotContext.Provider value={this.state.ctx}>
        <div style={{ position: 'relative' }}>
          <div ref={this.plotContainer} data-testid="uplot-main-div" />
          {this.props.children}
        </div>
      </PlotContext.Provider>
    );
  }
}
