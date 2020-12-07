import React, { PureComponent } from 'react';
import {
  compareDataFrameStructures,
  DefaultTimeZone,
  FieldSparkline,
  IndexVector,
  DataFrame,
  FieldType,
  getFieldColorModeForField,
  FieldConfig,
} from '@grafana/data';
import { AxisPlacement, DrawStyle, GraphFieldConfig, PointMode } from '../uPlot/config';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { UPlotChart } from '../uPlot/Plot';
import { Themeable } from '../../types';

export interface Props extends Themeable {
  width: number;
  height: number;
  config?: FieldConfig<GraphFieldConfig>;
  sparkline: FieldSparkline;
}

interface State {
  data: DataFrame;
  configBuilder: UPlotConfigBuilder;
}

const defaultConfig: GraphFieldConfig = {
  drawStyle: DrawStyle.Line,
  points: PointMode.Auto,
  axisPlacement: AxisPlacement.Hidden,
};

export class Sparkline extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    const data = this.perepareData(props);
    this.state = {
      data,
      configBuilder: this.prepareConfig(data, props),
    };
  }

  componentDidUpdate(oldProps: Props) {
    if (oldProps.sparkline !== this.props.sparkline) {
      const data = this.perepareData(this.props);
      if (!compareDataFrameStructures(this.state.data, data)) {
        const configBuilder = this.prepareConfig(data, this.props);
        this.setState({ data, configBuilder });
      } else {
        this.setState({ data });
      }
    }
  }

  perepareData = (props: Props): DataFrame => {
    const { sparkline } = this.props;
    const length = sparkline.y.values.length;
    const yFieldConfig = {
      ...sparkline.y.config,
      ...this.props.config,
    };
    return {
      refId: 'sparkline',
      fields: [
        sparkline.x ?? IndexVector.newField(length),
        {
          ...sparkline.y,
          config: yFieldConfig,
        },
      ],
      length,
    };
  };

  prepareConfig = (data: DataFrame, props: Props) => {
    const { theme } = this.props;
    const builder = new UPlotConfigBuilder();

    // X is the first field in the alligned frame
    const xField = data.fields[0];
    builder.addScale({
      scaleKey: 'x',
      isTime: xField.type === FieldType.time,
    });
    // builder.addAxis({
    //   scaleKey: 'x',
    //   theme,
    //   placement: AxisPlacement.Hidden,
    // });
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
      builder.addScale({ scaleKey, min: field.config.min, max: field.config.max });
      // builder.addAxis({
      //   scaleKey,
      //   theme,
      //   placement: AxisPlacement.Hidden,
      // });

      const colorMode = getFieldColorModeForField(field);
      const seriesColor = colorMode.getCalculator(field, theme)(0, 0);
      const pointsMode = customConfig.drawStyle === DrawStyle.Points ? PointMode.Always : customConfig.points;
      builder.addSeries({
        scaleKey,
        drawStyle: customConfig.drawStyle!,
        lineColor: customConfig.lineColor ?? seriesColor,
        lineWidth: customConfig.lineWidth,
        lineInterpolation: customConfig.lineInterpolation,
        points: pointsMode,
        pointSize: customConfig.pointSize,
        pointColor: customConfig.pointColor ?? seriesColor,
        fillOpacity: customConfig.fillOpacity,
        fillColor: customConfig.fillColor ?? seriesColor,
      });
    }

    return builder;
  };

  render() {
    const { data, configBuilder } = this.state;
    const { width, height, sparkline } = this.props;

    return (
      <UPlotChart
        data={{
          frame: data,
          isGap: () => true,
        }}
        config={configBuilder}
        width={width}
        height={height}
        timeRange={sparkline.timeRange!}
        timeZone={DefaultTimeZone}
      />
    );
  }
}
