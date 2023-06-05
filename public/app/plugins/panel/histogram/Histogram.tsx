import React from 'react';
import uPlot, { AlignedData } from 'uplot';

import {
  DataFrame,
  formattedValueToString,
  getFieldColorModeForField,
  getFieldSeriesColor,
  GrafanaTheme2,
} from '@grafana/data';
import {
  histogramBucketSizes,
  histogramFrameBucketMaxFieldName,
} from '@grafana/data/src/transformations/transformers/histogram';
import { VizLegendOptions, ScaleDistribution, AxisPlacement, ScaleDirection, ScaleOrientation } from '@grafana/schema';
import {
  Themeable2,
  UPlotConfigBuilder,
  UPlotChart,
  VizLayout,
  PlotLegend,
  measureText,
  UPLOT_AXIS_FONT_SIZE,
} from '@grafana/ui';

import { defaultPanelFieldConfig, PanelFieldConfig, PanelOptions } from './panelcfg.gen';

function incrRoundDn(num: number, incr: number) {
  return Math.floor(num / incr) * incr;
}

function incrRoundUp(num: number, incr: number) {
  return Math.ceil(num / incr) * incr;
}

export interface HistogramProps extends Themeable2 {
  options: PanelOptions; // used for diff
  alignedFrame: DataFrame; // This could take HistogramFields
  bucketSize: number;
  width: number;
  height: number;
  structureRev?: number; // a number that will change when the frames[] structure changes
  legend: VizLegendOptions;
  rawSeries?: DataFrame[];
  children?: (builder: UPlotConfigBuilder, frame: DataFrame) => React.ReactNode;
}

export function getBucketSize(frame: DataFrame) {
  // assumes BucketMin is fields[0] and BucktMax is fields[1]
  return frame.fields[1].values[0] - frame.fields[0].values[0];
}

const prepConfig = (frame: DataFrame, theme: GrafanaTheme2) => {
  // todo: scan all values in BucketMin and BucketMax fields to assert if uniform bucketSize

  let builder = new UPlotConfigBuilder();

  // assumes BucketMin is fields[0] and BucktMax is fields[1]
  let bucketSize = getBucketSize(frame);

  // splits shifter, to ensure splits always start at first bucket
  let xSplits: uPlot.Axis.Splits = (u, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace) => {
    /** @ts-ignore */
    let minSpace = u.axes[axisIdx]._space;
    let bucketWidth = u.valToPos(u.data[0][0] + bucketSize, 'x') - u.valToPos(u.data[0][0], 'x');

    let firstSplit = u.data[0][0];
    let lastSplit = u.data[0][u.data[0].length - 1] + bucketSize;

    let splits = [];
    let skip = Math.ceil(minSpace / bucketWidth);

    for (let i = 0, s = firstSplit; s <= lastSplit; i++, s += bucketSize) {
      !(i % skip) && splits.push(s);
    }

    return splits;
  };

  builder.addScale({
    scaleKey: 'x', // bukkits
    isTime: false,
    distribution: ScaleDistribution.Linear,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: (u, wantedMin, wantedMax) => {
      let fullRangeMin = u.data[0][0];
      let fullRangeMax = u.data[0][u.data[0].length - 1];

      // snap to bucket divisors...

      if (wantedMax === fullRangeMax) {
        wantedMax += bucketSize;
      } else {
        wantedMax = incrRoundUp(wantedMax, bucketSize);
      }

      if (wantedMin > fullRangeMin) {
        wantedMin = incrRoundDn(wantedMin, bucketSize);
      }

      return [wantedMin, wantedMax];
    },
  });

  builder.addScale({
    scaleKey: 'y', // counts
    isTime: false,
    distribution: ScaleDistribution.Linear,
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
  });

  const fmt = frame.fields[0].display!;
  const xAxisFormatter = (v: number) => {
    return formattedValueToString(fmt(v));
  };

  builder.addAxis({
    scaleKey: 'x',
    isTime: false,
    placement: AxisPlacement.Bottom,
    incrs: histogramBucketSizes,
    splits: xSplits,
    values: (u: uPlot, splits: any[]) => {
      const tickLabels = splits.map(xAxisFormatter);

      const maxWidth = tickLabels.reduce(
        (curMax, label) => Math.max(measureText(label, UPLOT_AXIS_FONT_SIZE).width, curMax),
        0
      );

      const labelSpacing = 10;
      const maxCount = u.bbox.width / ((maxWidth + labelSpacing) * devicePixelRatio);
      const keepMod = Math.ceil(tickLabels.length / maxCount);

      return tickLabels.map((label, i) => (i % keepMod === 0 ? label : null));
    },
    //incrs: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((mult) => mult * bucketSize),
    //splits: config.xSplits,
    //values: config.xValues,
    //grid: false,
    //ticks: false,
    //gap: 15,
    theme,
  });

  // assumes BucketMax is [1]
  let countField = frame.fields[2];
  let dispY = countField.display;

  builder.addAxis({
    scaleKey: 'y',
    isTime: false,
    placement: AxisPlacement.Left,
    formatValue: (v, decimals) => formattedValueToString(dispY!(v, decimals)),
    //splits: config.xSplits,
    //values: config.xValues,
    //grid: false,
    //ticks: false,
    //gap: 15,
    theme,
  });

  builder.setCursor({
    points: { show: false },
    drag: {
      x: true,
      y: false,
      setScale: true,
    },
  });

  let pathBuilder = uPlot.paths.bars!({ align: 1, size: [1, Infinity] });

  let seriesIndex = 0;

  // assumes xMin is [0], xMax is [1]
  for (let i = 2; i < frame.fields.length; i++) {
    const field = frame.fields[i];

    field.state = field.state ?? {};
    field.state.seriesIndex = seriesIndex++;

    const customConfig: PanelFieldConfig = { ...defaultPanelFieldConfig, ...field.config.custom };

    const scaleKey = 'y';
    const colorMode = getFieldColorModeForField(field);
    const scaleColor = getFieldSeriesColor(field, theme);
    const seriesColor = scaleColor.color;

    builder.addSeries({
      scaleKey,
      lineWidth: customConfig.lineWidth,
      lineColor: seriesColor,
      //lineStyle: customConfig.lineStyle,
      fillOpacity: customConfig.fillOpacity,
      theme,
      colorMode,
      pathBuilder,
      //pointsBuilder: config.drawPoints,
      show: !customConfig.hideFrom?.viz,
      gradientMode: customConfig.gradientMode,
      thresholds: field.config.thresholds,

      hardMin: field.config.min,
      hardMax: field.config.max,
      softMin: customConfig.axisSoftMin,
      softMax: customConfig.axisSoftMax,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      dataFrameFieldIndex: field.state.origin,
    });
  }

  return builder;
};

const preparePlotData = (frame: DataFrame) => {
  let data = [];

  for (const field of frame.fields) {
    if (field.name !== histogramFrameBucketMaxFieldName) {
      data.push(field.values);
    }
  }

  // uPlot's bars pathBuilder will draw rects even if 0 (to distinguish them from nulls)
  // but for histograms we want to omit them, so remap 0s -> nulls
  for (let i = 1; i < data.length; i++) {
    let counts = data[i];
    for (let j = 0; j < counts.length; j++) {
      if (counts[j] === 0) {
        counts[j] = null;
      }
    }
  }

  return data as AlignedData;
};

interface State {
  alignedData: AlignedData;
  config?: UPlotConfigBuilder;
}

export class Histogram extends React.Component<HistogramProps, State> {
  constructor(props: HistogramProps) {
    super(props);
    this.state = this.prepState(props);
  }

  prepState(props: HistogramProps, withConfig = true) {
    let state: State = null as any;

    const { alignedFrame } = props;
    if (alignedFrame) {
      state = {
        alignedData: preparePlotData(alignedFrame),
      };

      if (withConfig) {
        state.config = prepConfig(alignedFrame, this.props.theme);
      }
    }

    return state;
  }

  renderLegend(config: UPlotConfigBuilder) {
    const { legend } = this.props;

    if (!config || legend.showLegend === false) {
      return null;
    }

    return <PlotLegend data={this.props.rawSeries!} config={config} maxHeight="35%" maxWidth="60%" {...legend} />;
  }

  componentDidUpdate(prevProps: HistogramProps) {
    const { structureRev, alignedFrame, bucketSize } = this.props;

    if (alignedFrame !== prevProps.alignedFrame) {
      let newState = this.prepState(this.props, false);

      if (newState) {
        const shouldReconfig =
          bucketSize !== prevProps.bucketSize ||
          this.props.options !== prevProps.options ||
          this.state.config === undefined ||
          structureRev !== prevProps.structureRev ||
          !structureRev;

        if (shouldReconfig) {
          newState.config = prepConfig(alignedFrame, this.props.theme);
        }
      }

      newState && this.setState(newState);
    }
  }

  render() {
    const { width, height, children, alignedFrame } = this.props;
    const { config } = this.state;

    if (!config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={this.renderLegend(config)}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            config={this.state.config!}
            data={this.state.alignedData}
            width={vizWidth}
            height={vizHeight}
            timeRange={null as any}
          >
            {children ? children(config, alignedFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}
