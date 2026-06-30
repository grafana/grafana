import { Component, createRef } from 'react';
import uPlot, { type AlignedData, type Options } from 'uplot';

import { UPlotA11y } from './UPlotA11y';
import { type PlotProps } from './types';
import { pluginLog } from './utils';

import 'uplot/dist/uPlot.min.css';

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

let uniqueIdCounter = 0;

/**
 * @internal
 * uPlot abstraction responsible for plot initialisation, setup and refresh
 * Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
 * Exposes context for uPlot instance access
 */
export class UPlotChart extends Component<PlotProps, UPlotChartState> {
  plotContainer = createRef<HTMLDivElement>();
  plotCanvasBBox = createRef<DOMRect>();
  plotInstance: uPlot | null = null;
  uniqueA11yId: string;

  constructor(props: PlotProps) {
    super(props);
    this.uniqueA11yId = `uplot-a11y-${uniqueIdCounter}`;
    uniqueIdCounter++;
  }

  reinitPlot() {
    let { width, height, plotRef } = this.props;

    this.plotInstance?.destroy();

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

    this.plotInstance = plot;

    // accessibility attribute monkeypatching each time we get a new uPlot instance.
    this.plotInstance.over?.setAttribute('tabindex', '-1');

    this.plotInstance.root?.setAttribute('tabindex', '0');
    this.plotInstance.root?.setAttribute('role', 'figure');
    this.plotInstance.root?.setAttribute('aria-label', config.title ?? 'uPlot chart');
    this.plotInstance.root?.setAttribute('aria-describedby', this.uniqueA11yId);
  }

  componentDidMount() {
    this.reinitPlot();
  }

  componentWillUnmount() {
    this.plotInstance?.destroy();
  }

  componentDidUpdate(prevProps: PlotProps) {
    if (!sameDims(prevProps, this.props)) {
      this.plotInstance?.setSize({
        width: Math.floor(this.props.width),
        height: Math.floor(this.props.height),
      });
    } else if (!sameConfig(prevProps, this.props)) {
      this.reinitPlot();
    } else if (!sameData(prevProps, this.props)) {
      this.plotInstance?.setData(this.props.data as AlignedData);
    }
  }

  render() {
    return (
      <div style={{ position: 'relative' }}>
        <div ref={this.plotContainer} data-testid="uplot-main-div" />
        {this.props.children}
        <UPlotA11y frames={this.props.frames} id={this.uniqueA11yId} />
      </div>
    );
  }
}
