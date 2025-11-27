import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { PureComponent } from 'react';
import { AlignedData, Range } from 'uplot';

import {
  compareDataFrameStructures,
  DataFrame,
  Field,
  FieldConfig,
  FieldSparkline,
  FieldType,
  getFieldColorModeForField,
  nullToValue,
} from '@grafana/data';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  VisibilityMode,
  ScaleDirection,
  ScaleOrientation,
} from '@grafana/schema';

import { Themeable2 } from '../../types/theme';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

import { getYRange, preparePlotFrame } from './utils';

export interface SparklineProps extends Themeable2 {
  width: number;
  height: number;
  config?: FieldConfig<GraphFieldConfig>;
  sparkline: FieldSparkline;
  onHover?: (value: number | null, index: number | null) => void;
}

interface State {
  data: AlignedData;
  alignedDataFrame: DataFrame;
  configBuilder: UPlotConfigBuilder;
}

const defaultConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  showPoints: VisibilityMode.Auto,
  axisPlacement: AxisPlacement.Hidden,
  pointSize: 2,
};

/** @internal */
export class Sparkline extends PureComponent<SparklineProps, State> {
  constructor(props: SparklineProps) {
    super(props);

    const alignedDataFrame = preparePlotFrame(props.sparkline, props.config);

    this.state = {
      data: preparePlotData2(alignedDataFrame, getStackingGroups(alignedDataFrame)),
      alignedDataFrame,
      configBuilder: this.prepareConfig(alignedDataFrame),
    };
  }

  static getDerivedStateFromProps(props: SparklineProps, state: State) {
    const _frame = preparePlotFrame(props.sparkline, props.config);
    const frame = nullToValue(_frame);
    if (!frame) {
      return { ...state };
    }

    return {
      ...state,
      data: preparePlotData2(frame, getStackingGroups(frame)),
      alignedDataFrame: frame,
    };
  }

  componentDidUpdate(prevProps: SparklineProps, prevState: State) {
    const { alignedDataFrame } = this.state;

    if (!alignedDataFrame) {
      return;
    }

    let rebuildConfig = false;

    if (prevProps.sparkline !== this.props.sparkline) {
      const isStructureChanged = !compareDataFrameStructures(this.state.alignedDataFrame, prevState.alignedDataFrame);
      const isRangeChanged = !isEqual(
        alignedDataFrame.fields[1].state?.range,
        prevState.alignedDataFrame.fields[1].state?.range
      );
      rebuildConfig = isStructureChanged || isRangeChanged;
    } else {
      rebuildConfig = !isEqual(prevProps.config, this.props.config);
    }

    if (rebuildConfig) {
      this.setState({ configBuilder: this.prepareConfig(alignedDataFrame) });
    }
  }

  getYRange(field: Field): Range.MinMax {
    return getYRange(field, this.state.alignedDataFrame);
  }

  prepareConfig(data: DataFrame) {
    const { theme, onHover, config } = this.props;
    const builder = new UPlotConfigBuilder();

    // Check if interaction is enabled (default to true)
    // Use type assertion since interactionEnabled is on TableSparklineCellOptions
    const interactionEnabled = (config?.custom as any)?.interactionEnabled ?? true;

    // X is the first field in the alligned frame
    const xField = data.fields[0];
    builder.addScale({
      scaleKey: 'x',
      orientation: ScaleOrientation.Horizontal,
      direction: ScaleDirection.Right,
      isTime: false, //xField.type === FieldType.time,
      range: () => {
        const { sparkline } = this.props;
        if (sparkline.x) {
          if (sparkline.timeRange && sparkline.x.type === FieldType.time) {
            return [sparkline.timeRange.from.valueOf(), sparkline.timeRange.to.valueOf()];
          }
          const vals = sparkline.x.values;
          return [vals[0], vals[vals.length - 1]];
        }
        return [0, sparkline.y.values.length - 1];
      },
    });

    builder.addAxis({
      scaleKey: 'x',
      theme,
      placement: AxisPlacement.Hidden,
    });

    // Track the series color for cursor point styling
    let seriesColor: string | undefined;

    for (let i = 0; i < data.fields.length; i++) {
      const field = data.fields[i];
      const config: FieldConfig<GraphFieldConfig> = field.config;
      const customConfig: GraphFieldConfig = {
        ...defaultConfig,
        ...config.custom,
      };

      if (field === xField || field.type !== FieldType.number) {
        continue;
      }

      const scaleKey = config.unit || '__fixed';
      builder.addScale({
        scaleKey,
        orientation: ScaleOrientation.Vertical,
        direction: ScaleDirection.Up,
        range: () => this.getYRange(field),
      });

      builder.addAxis({
        scaleKey,
        theme,
        placement: AxisPlacement.Hidden,
      });

      const colorMode = getFieldColorModeForField(field);
      seriesColor = colorMode.getCalculator(field, theme)(0, 0);
      const pointsMode =
        customConfig.drawStyle === GraphDrawStyle.Points ? VisibilityMode.Always : customConfig.showPoints;

      builder.addSeries({
        pxAlign: false,
        scaleKey,
        theme,
        colorMode,
        thresholds: config.thresholds,
        drawStyle: customConfig.drawStyle!,
        lineColor: customConfig.lineColor ?? seriesColor,
        lineWidth: customConfig.lineWidth,
        lineInterpolation: customConfig.lineInterpolation,
        showPoints: pointsMode,
        pointSize: customConfig.pointSize || 5, // Ensure minimum size for cursor point calculation
        fillOpacity: customConfig.fillOpacity,
        fillColor: customConfig.fillColor,
        lineStyle: customConfig.lineStyle,
        gradientMode: customConfig.gradientMode,
        spanNulls: customConfig.spanNulls,
      });
    }

    // Configure cursor after series so we have the series color
    if (interactionEnabled && onHover) {
      // Enable cursor with vertical bar indicator for hover interaction
      // Vertical bar is more visible on small sparklines (25-30px height) than a dot
      builder.setCursor({
        show: true,
        x: true, // show vertical line (bar indicator)
        y: false, // no horizontal line
        points: {
          show: false, // don't show dots - use vertical bar instead
          // Provide safe functions that don't access this.frames (which is undefined for Sparkline)
          stroke: () => 'transparent',
          fill: () => 'transparent',
          size: () => 0,
          width: () => 0,
        },
        focus: {
          prox: 30, // proximity in CSS pixels for hover detection
        },
      } as any); // Type assertion needed for cursor styling properties

      // Track cursor position and call onHover with the value at that position
      // Using setLegend hook which fires on hover (not just drag-to-select like setSelect)
      builder.addHook('setLegend', (u) => {
        const dataIdx = u.cursor.idxs?.[1]; // Get the data index from the cursor
        if (dataIdx != null) {
          const yData = u.data[1]; // Y-axis data (values)
          if (yData && dataIdx < yData.length) {
            const value = yData[dataIdx];
            if (value != null && isFinite(value)) {
              onHover(value, dataIdx);
              return;
            }
          }
        }
        // Reset on mouse leave or when no valid data point
        onHover(null, null);
      });
    } else {
      // Default behavior: cursor disabled
      builder.setCursor({
        show: false,
        x: false, // no crosshairs
        y: false,
      });
    }

    return builder;
  }

  render() {
    const { data, configBuilder } = this.state;
    const { width, height } = this.props;

    // Style the vertical cursor bar to be more visible on small sparklines
    const cursorStyles = css`
      .u-cursor-x {
        border-left: 2px solid !important;
        opacity: 1 !important;
      }
    `;

    return (
      <div className={cursorStyles}>
        <UPlotChart data={data} config={configBuilder} width={width} height={height} />
      </div>
    );
  }
}
