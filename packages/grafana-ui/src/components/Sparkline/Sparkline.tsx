import { isEqual } from 'lodash';
import React, { PureComponent } from 'react';
import { AlignedData, Range } from 'uplot';

import {
  compareDataFrameStructures,
  DataFrame,
  Field,
  FieldConfig,
  FieldSparkline,
  FieldType,
  getFieldColorModeForField,
} from '@grafana/data';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  VisibilityMode,
  ScaleDirection,
  ScaleOrientation,
} from '@grafana/schema';

import { Themeable2 } from '../../types';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

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
  drawStyle: GraphDrawStyle.Line,
  showPoints: VisibilityMode.Auto,
  axisPlacement: AxisPlacement.Hidden,
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
    const frame = preparePlotFrame(props.sparkline, props.config);
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
      rebuildConfig = !compareDataFrameStructures(this.state.alignedDataFrame, prevState.alignedDataFrame);
    } else {
      rebuildConfig = !isEqual(prevProps.config, this.props.config);
    }

    if (rebuildConfig) {
      this.setState({ configBuilder: this.prepareConfig(alignedDataFrame) });
    }
  }

  getYRange(field: Field): Range.MinMax {
    let { min, max } = this.state.alignedDataFrame.fields[1].state?.range!;

    if (min === max) {
      if (min === 0) {
        max = 100;
      } else {
        min = 0;
        max! *= 2;
      }

      return [min, max!];
    }

    return [Math.max(min!, field.config.min ?? -Infinity), Math.min(max!, field.config.max ?? Infinity)];
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
        range: () => this.getYRange(field),
      });

      builder.addAxis({
        scaleKey,
        theme,
        placement: AxisPlacement.Hidden,
      });

      const colorMode = getFieldColorModeForField(field);
      const seriesColor = colorMode.getCalculator(field, theme)(0, 0);
      const pointsMode =
        customConfig.drawStyle === GraphDrawStyle.Points ? VisibilityMode.Always : customConfig.showPoints;

      builder.addSeries({
        pxAlign: false,
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
