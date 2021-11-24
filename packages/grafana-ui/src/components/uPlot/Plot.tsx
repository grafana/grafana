import React, { createRef } from 'react';
import uPlot, { AlignedData, Options } from 'uplot';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { getFocusStyles } from '../../themes/mixins';
import { DEFAULT_PLOT_CONFIG, pluginLog } from './utils';
import { PlotProps } from './types';

import { stylesFactory } from '../../themes/stylesFactory';
import { ThemeContext } from '../../themes/ThemeContext';

const PIXELS_PER_MS = 0.1 as const;
const SHIFT_MULTIPLIER = 2 as const;
const SUPPORTED_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift', ' '] as const;
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
};

interface KeyboardState {
  pressedKeys: Record<SupportedKey, boolean>;
  keysLastHandledAt: number | null;
  dragStartX: number | null;
}

const initialKeyboardState: KeyboardState = {
  pressedKeys: {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Shift: false,
    ' ': false,
  },
  keysLastHandledAt: null,
  dragStartX: null,
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
  keyboardState = initialKeyboardState;
  state: UPlotChartState = { plot: null };

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
      ms: 1,
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

  handleKeyRelease = (e: React.KeyboardEvent) => {
    if (!SUPPORTED_KEYS.includes(e.key as SupportedKey)) {
      return;
    }

    this.keyboardState.pressedKeys[e.key as SupportedKey] = false;

    if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();

      // We do this so setSelect hooks get fired, zooming the plot
      this.state.plot?.setSelect(this.state.plot.select);
      this.keyboardState.dragStartX = null;
    }
  };

  handleKeys = (e: React.KeyboardEvent) => {
    if (!SUPPORTED_KEYS.includes(e.key as SupportedKey)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const newKey = !this.keyboardState.pressedKeys[e.key as SupportedKey];
    if (newKey) {
      const initiateAnimationLoop = Object.values(this.keyboardState.pressedKeys).every((pressed) => pressed === false);
      this.keyboardState.pressedKeys[e.key as SupportedKey] = true;
      this.keyboardState.dragStartX =
        e.key === ' ' && this.keyboardState.dragStartX === null
          ? this.state.plot?.cursor.left!
          : this.keyboardState.dragStartX;

      if (initiateAnimationLoop) {
        window.requestAnimationFrame(this.handlePressedKeys);
      }
    }
  };

  handlePressedKeys = (time: number) => {
    const nothingPressed = Object.values(this.keyboardState.pressedKeys).every((pressed) => pressed === false);
    if (nothingPressed || !this.state.plot) {
      this.keyboardState.keysLastHandledAt = null;
      return;
    }

    const dt = time - (this.keyboardState.keysLastHandledAt ?? time);
    const dx = dt * PIXELS_PER_MS;
    let horValue = 0;
    let vertValue = 0;

    if (this.keyboardState.pressedKeys.ArrowUp) {
      vertValue -= dx;
    }
    if (this.keyboardState.pressedKeys.ArrowDown) {
      vertValue += dx;
    }
    if (this.keyboardState.pressedKeys.ArrowLeft) {
      horValue -= dx;
    }
    if (this.keyboardState.pressedKeys.ArrowRight) {
      horValue += dx;
    }
    if (this.keyboardState.pressedKeys.Shift) {
      horValue *= SHIFT_MULTIPLIER;
      vertValue *= SHIFT_MULTIPLIER;
    }

    this.moveCursor(horValue, vertValue);

    const cursor = this.state.plot.cursor;
    if (this.keyboardState.pressedKeys[' '] && cursor) {
      const drawHeight = Number(this.state.plot.over.style.height.slice(0, -2));

      this.state.plot.setSelect(
        {
          left: cursor.left! < this.keyboardState.dragStartX! ? cursor.left! : this.keyboardState.dragStartX!,
          top: 0,
          width: Math.abs(cursor.left! - (this.keyboardState.dragStartX ?? cursor.left!)),
          height: drawHeight,
        },
        false
      );
    }

    this.keyboardState.keysLastHandledAt = time;
    window.requestAnimationFrame(this.handlePressedKeys);
  };

  moveCursor = (dx: number, dy: number) => {
    if (this.state.plot?.cursor.left === undefined) {
      return;
    }

    const { cursor } = this.state.plot;
    this.state.plot.setCursor({
      left: cursor.left! + dx,
      top: cursor.top! + dy,
    });
  };

  handleFocus = () => {
    // Is there a more idiomatic way to do this?
    const drawWidth = Number(this.state.plot?.over.style.width.slice(0, -2));
    const drawHeight = Number(this.state.plot?.over.style.height.slice(0, -2));

    this.state.plot?.setCursor({ left: drawWidth / 2, top: drawHeight / 2 });
  };

  handleBlur = () => {
    this.keyboardState = initialKeyboardState;
    this.state.plot?.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
  };

  render() {
    return (
      <div style={{ position: 'relative' }}>
        <ThemeContext.Consumer>
          {(theme) => {
            const styles = getStyles(theme);
            return (
              <div
                className={styles.focusStyle}
                ref={this.plotContainer}
                data-testid="uplot-main-div"
                tabIndex={0}
                onFocusCapture={this.handleFocus}
                onBlur={this.handleBlur}
                onKeyDown={this.handleKeys}
                onKeyUp={this.handleKeyRelease}
              />
            );
          }}
        </ThemeContext.Consumer>
        {this.props.children}
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  focusStyle: css({
    borderRadius: theme.shape.borderRadius(1),
    '&:focus-visible': getFocusStyles(theme),
  }),
}));
