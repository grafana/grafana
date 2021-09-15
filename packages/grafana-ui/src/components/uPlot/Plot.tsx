import React, { createRef } from 'react';
import uPlot, { Options } from 'uplot';
import { DEFAULT_PLOT_CONFIG, pluginLog } from './utils';
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

function sameTimeRange(prevProps: PlotProps, nextProps: PlotProps) {
  let prevTime = prevProps.timeRange;
  let nextTime = nextProps.timeRange;

  return (
    prevTime === nextTime ||
    (nextTime.from.valueOf() === prevTime.from.valueOf() && nextTime.to.valueOf() === prevTime.to.valueOf())
  );
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
export class UPlotChart extends React.Component<PlotProps, UPlotChartState> {
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
      ...DEFAULT_PLOT_CONFIG,
      width: this.props.width,
      height: this.props.height,
      ms: 1 as 1,
      ...this.props.config.getConfig(),
    };

    pluginLog('UPlot', false, 'Reinitializing plot', config);
    const plot = new uPlot(config, this.props.data, this.plotContainer!.current!);

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
        width: this.props.width,
        height: this.props.height,
      });
    } else if (!sameConfig(prevProps, this.props)) {
      this.reinitPlot();
    } else if (!sameData(prevProps, this.props)) {
      plot?.setData(this.props.data);

      // this is a uPlot cache-busting hack for bar charts in case x axis labels changed
      // since the x scale's "range" doesnt change, the axis size doesnt get recomputed, which is where the tick labels are regenerated & cached
      // the more expensive, more proper/thorough way to do this is to force all axes to recalc: plot?.redraw(false, true);
      if (plot && typeof this.props.data[0][0] === 'string') {
        //@ts-ignore
        plot.axes[0]._values = this.props.data[0];
      }
    } else if (!sameTimeRange(prevProps, this.props)) {
      plot?.setScale('x', {
        min: this.props.timeRange.from.valueOf(),
        max: this.props.timeRange.to.valueOf(),
      });
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
