import React, { createRef } from 'react';
import uPlot, { AlignedData, Options } from 'uplot';
import { throttle } from 'lodash';
import { DEFAULT_PLOT_CONFIG, pluginLog } from './utils';
import { PlotProps } from './types';

const PIXELS_PER_MS = 0.1;
const SHIFT_MULTIPLIER = 2;
const SUPPORTED_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift'] as const;
type SupportedKey = typeof SUPPORTED_KEYS[number];

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
  pressedKeys: Record<SupportedKey, boolean>;
  keyHandleTimestamp: number;
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
  throttledHandleKeys: (e: React.KeyboardEvent) => void;

  constructor(props: PlotProps) {
    super(props);

    this.state = {
      plot: null,
      pressedKeys: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
        Shift: false,
      },
      keyHandleTimestamp: 0,
    };

    this.throttledHandleKeys = throttle(this.handleKeys, 16.7);
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
        width: this.props.width,
        height: this.props.height,
      });
    } else if (!sameConfig(prevProps, this.props)) {
      this.reinitPlot();
    } else if (!sameData(prevProps, this.props)) {
      plot?.setData(this.props.data as AlignedData);

      // this is a uPlot cache-busting hack for bar charts in case x axis labels changed
      // since the x scale's "range" doesnt change, the axis size doesnt get recomputed, which is where the tick labels are regenerated & cached
      // the more expensive, more proper/thorough way to do this is to force all axes to recalc: plot?.redraw(false, true);
      if (plot && typeof this.props.data[0]?.[0] === 'string') {
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

  moveCursor = (dx: number, dy: number) => {
    const cursor = this.state.plot?.cursor;

    this.state.plot?.setCursor({
      left: (cursor?.left ?? this.state.plot?.width / 2) + dx,
      top: (cursor?.top ?? this.state.plot?.height / 2) + dy,
    });
  };

  handleKeys = (e: React.KeyboardEvent) => {
    if (!SUPPORTED_KEYS.includes(e.key as SupportedKey)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const initiateAnimationLoop = Object.values(this.state.pressedKeys).every((pressed) => pressed === false);

    this.setState(
      (state) => ({
        pressedKeys: { ...state.pressedKeys, [e.key]: true },
        keyHandleTimestamp: initiateAnimationLoop ? performance.now() : state.keyHandleTimestamp,
      }),
      () => {
        if (initiateAnimationLoop) {
          window.requestAnimationFrame(this.handlePressedKeys);
        }
      }
    );
  };

  handleKeyRelease = (e: React.KeyboardEvent) => {
    if (!SUPPORTED_KEYS.includes(e.key as SupportedKey)) {
      return;
    }

    this.setState((state) => ({
      pressedKeys: { ...state.pressedKeys, [e.key]: false },
    }));
  };

  handlePressedKeys = (time: number) => {
    const nothingPressed = Object.values(this.state.pressedKeys).every((pressed) => pressed === false);
    if (nothingPressed) {
      return;
    }

    const dt = time - this.state.keyHandleTimestamp;
    const dx = dt * PIXELS_PER_MS;
    let horValue = 0;
    let vertValue = 0;
    if (this.state.pressedKeys['ArrowUp']) {
      vertValue -= dx;
    }
    if (this.state.pressedKeys['ArrowDown']) {
      vertValue += dx;
    }
    if (this.state.pressedKeys['ArrowLeft']) {
      horValue -= dx;
    }
    if (this.state.pressedKeys['ArrowRight']) {
      horValue += dx;
    }
    if (this.state.pressedKeys['Shift']) {
      horValue *= SHIFT_MULTIPLIER;
      vertValue *= SHIFT_MULTIPLIER;
    }

    this.moveCursor(horValue, vertValue);
    this.setState(
      {
        keyHandleTimestamp: time,
      },
      () => {
        window.requestAnimationFrame(this.handlePressedKeys);
      }
    );
  };

  handleFocus = () => {
    this.state.plot?.setCursor({ left: this.state.plot.width / 2, top: this.state.plot.height / 2 });
  };

  handleBlur = () => {
    this.setState({
      pressedKeys: SUPPORTED_KEYS.reduce(
        (pressed, cur) => ({ ...pressed, [cur]: false }),
        {} as Record<SupportedKey, boolean>
      ),
    });
  };

  render() {
    return (
      <div style={{ position: 'relative' }}>
        <div
          ref={this.plotContainer}
          data-testid="uplot-main-div"
          tabIndex={0}
          onFocusCapture={this.handleFocus}
          onBlur={this.handleBlur}
          onKeyDown={this.throttledHandleKeys}
          onKeyUp={this.handleKeyRelease}
        />
        {this.props.children}
      </div>
    );
  }
}
