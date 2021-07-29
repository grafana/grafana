import React, { PureComponent } from 'react';
import { AlignedData } from 'uplot';
import {
  compareDataFrameStructures,
  DataFrame,
  FieldConfig,
  FieldSparkline,
  FieldType,
  getFieldColorModeForField,
} from '@grafana/data';
import {
  AxisPlacement,
  DrawStyle,
  GraphFieldConfig,
  PointVisibility,
  ScaleDirection,
  ScaleOrientation,
} from '../uPlot/config';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { UPlotChart } from '../uPlot/Plot';
import { Themeable2 } from '../../types';
import { preparePlotData } from '../uPlot/utils';
import { preparePlotFrame } from './utils';

export interface SparklineProps extends Themeable2 {
  width: number;
  height: number;
  config?: FieldConfig<GraphFieldConfig>;
  sparkline: FieldSparkline;
}

interface State {
  data: AlignedData;
  alignedDataFrame: DataFrame;
  configBuilder: UPlotConfigBuilder;
}

const defaultConfig: GraphFieldConfig = {
  drawStyle: DrawStyle.Line,
  showPoints: PointVisibility.Auto,
  axisPlacement: AxisPlacement.Hidden,
};

export class Sparkline extends PureComponent<SparklineProps, State> {
  constructor(props: SparklineProps) {
    super(props);

    const alignedDataFrame = preparePlotFrame(props.sparkline, props.config);

    this.state = {
      data: preparePlotData(alignedDataFrame),
      alignedDataFrame,
      configBuilder: this.prepareConfig(alignedDataFrame),
    };
  }

  static getDerivedStateFromProps(props: SparklineProps, state: State) {
    const frame = preparePlotFrame(props.sparkline, props.config);
    if (!frame) {
      return { ...state };
    }

    return {
      ...state,
      data: preparePlotData(frame),
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
      rebuildConfig = !compareDataFrameStructures(this.state.alignedDataFrame, prevState.alignedDataFrame);
    } else if (prevProps.config !== this.props.config) {
      rebuildConfig = true;
    }

    if (rebuildConfig) {
      this.setState({ configBuilder: this.prepareConfig(alignedDataFrame) });
    }
  }

  prepareConfig(data: DataFrame) {
    const { theme } = this.props;
    const builder = new UPlotConfigBuilder();

    builder.setCursor({
      show: false,
      x: false, // no crosshairs
      y: false,
    });

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
          return [vals.get(0), vals.get(vals.length - 1)];
        }
        return [0, sparkline.y.values.length - 1];
      },
    });

    builder.addAxis({
      scaleKey: 'x',
      theme,
      placement: AxisPlacement.Hidden,
    });

    for (let i = 0; i < data.fields.length; i++) {
      const field = data.fields[i];
      const config = field.config as FieldConfig<GraphFieldConfig>;
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
        min: field.config.min,
        max: field.config.max,
        getDataMinMax: () => field.state?.range,
      });

      builder.addAxis({
        scaleKey,
        theme,
        placement: AxisPlacement.Hidden,
      });

      const colorMode = getFieldColorModeForField(field);
      const seriesColor = colorMode.getCalculator(field, theme)(0, 0);
      const pointsMode = customConfig.drawStyle === DrawStyle.Points ? PointVisibility.Always : customConfig.showPoints;

      builder.addSeries({
        scaleKey,
        theme,
        drawStyle: customConfig.drawStyle!,
        lineColor: customConfig.lineColor ?? seriesColor,
        lineWidth: customConfig.lineWidth,
        lineInterpolation: customConfig.lineInterpolation,
        showPoints: pointsMode,
        pointSize: customConfig.pointSize,
        fillOpacity: customConfig.fillOpacity,
        fillColor: customConfig.fillColor ?? seriesColor,
      });
    }

    return builder;
  }

  render() {
    const { data, configBuilder } = this.state;
    const { width, height, sparkline } = this.props;
    return (
      <UPlotChart data={data} config={configBuilder} width={width} height={height} timeRange={sparkline.timeRange!} />
    );
  }
}
