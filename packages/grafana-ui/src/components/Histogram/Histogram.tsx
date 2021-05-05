import React from 'react';
import uPlot, { AlignedData } from 'uplot';
import {
  ArrayVector,
  DataFrame,
  FieldType,
  getFieldColorModeForField,
  getFieldDisplayName,
  getFieldSeriesColor,
  GrafanaTheme2,
} from '@grafana/data';
import { Themeable2 } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { UPlotChart } from '../uPlot/Plot';
import { VizLegendOptions } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';
import { incrRoundDn, histogram } from './utils';
import { withTheme2 } from '../../themes';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation } from '../uPlot/config';

/* eslint-disable */
const bucketSizes = [
  .001, .002, .0025, .005,
   .01,  .02,  .025,  .05,
    .1,   .2,   .25,   .5,
     1,    2,           5,
    10,   20,    25,   50,
   100,  200,   250,  500,
  1000, 2000,  2500, 5000,
];
/* eslint-enable */

const histFilter = [null];
const histSort = (a: number, b: number) => a - b;

function preparePlotFrame(frames: DataFrame[], bucketSize?: number | null) {
  let bucketMin = frames[0].fields.find((f) => f.name === 'BucketMin');
  let bucketMax = frames[0].fields.find((f) => f.name === 'BucketMax');

  // if single frame with BucketMin and BucketMax fields, assume pre-aggregated histogram
  if (bucketMin && bucketMax) {
    return frames[0];
  }
  // else aggregate all numeric fields in JS
  else {
    // TODO: make into a HistogramFrame type?
    // e.g. AlignedData: https://github.com/leeoniya/uPlot/blob/0ccd572074199f013733a89c4d756b7502a759c6/dist/uPlot.d.ts#L197-L200
    const histFrame: DataFrame = {
      // number of buckets
      length: 0,
      fields: [
        // inclusive
        { name: 'BucketMin', values: null, type: FieldType.number, config: {} },
        // exclusive
        { name: 'BucketMax', values: null, type: FieldType.number, config: {} },

        //...bucket counts
      ],
    };

    // if bucket size is auto, try to calc from all numeric fields
    if (!bucketSize) {
      let min = Infinity,
        max = -Infinity;

      for (const frame of frames) {
        for (const field of frame.fields) {
          if (field.type === FieldType.number) {
            for (const value of field.values.toArray()) {
              min = Math.min(min, value);
              max = Math.max(max, value);
            }
          }
        }
      }

      let range = Math.abs(max - min);

      // choose bucket
      for (const size of bucketSizes) {
        if (range / 10 < size) {
          bucketSize = size;
          break;
        }
      }
    }

    const histRound = (v: number) => incrRoundDn(v, bucketSize!);

    let histograms: AlignedData[] = [];

    for (const frame of frames) {
      for (const field of frame.fields) {
        if (field.type === FieldType.number) {
          let fieldHist = histogram(field.values.toArray(), histRound, histFilter, histSort) as AlignedData;
          histograms.push(fieldHist);
        }
      }
    }

    // align histograms
    let joinedHists = uPlot.join(histograms);

    // number of buckets
    histFrame.length = joinedHists[0].length;

    histFrame.fields[0].values = new ArrayVector(joinedHists[0]);
    histFrame.fields[1].values = new ArrayVector(joinedHists[0].map((v) => v + bucketSize!));

    let i = 1;
    for (const frame of frames) {
      for (const field of frame.fields) {
        if (field.type === FieldType.number) {
          histFrame.fields.push({
            ...field,
            values: new ArrayVector(joinedHists[i]),
          });

          i++;
        }
      }
    }

    return histFrame;
  }
  /*
    let frameCopy = {
      ...frame,
      fields: frame.fields.map((f, fieldIndex) => {
        const copy = { ...f };
        const origin = {
          frameIndex: 0,
          fieldIndex,
        };
        if (copy.state) {
          copy.state.origin = origin;
        } else {
          copy.state = { origin };
        }
        return copy;
      }),
    };
  }
*/
}
/*
export function preparePlotData(frame: DataFrame, keepFieldTypes?: FieldType[]): AlignedData {
  const result: any[] = [];
  const stackingGroups: Map<string, number[]> = new Map();
  let seriesIndex = 0;

  for (let i = 0; i < frame.fields.length; i++) {
    const f = frame.fields[i];

    if (f.type === FieldType.number) {
      if (f.values.length > 0 && typeof f.values.get(0) === 'string') {
        const timestamps = [];
        for (let i = 0; i < f.values.length; i++) {
          timestamps.push(dateTime(f.values.get(i)).valueOf());
        }
        result.push(timestamps);
        seriesIndex++;
        continue;
      }
      result.push(f.values.toArray());
      seriesIndex++;
      continue;
    }

    if (keepFieldTypes && keepFieldTypes.indexOf(f.type) < 0) {
      continue;
    }

    collectStackingGroups(f, stackingGroups, seriesIndex);
    result.push(f.values.toArray());
    seriesIndex++;
  }

  // Stacking
  if (stackingGroups.size !== 0) {
    // array or stacking groups
    for (const [_, seriesIdxs] of stackingGroups.entries()) {
      const acc = Array(result[0].length).fill(0);

      for (let j = 0; j < seriesIdxs.length; j++) {
        const currentlyStacking = result[seriesIdxs[j]];

        for (let k = 0; k < result[0].length; k++) {
          const v = currentlyStacking[k];
          acc[k] += v == null ? 0 : +v;
        }

        result[seriesIdxs[j]] = acc.slice();
      }
    }
  }

  return result as AlignedData;
}
*/

export interface HistogramProps extends Themeable2 {
  width: number;
  height: number;
  frames: DataFrame[];
  structureRev?: number; // a number that will change when the frames[] structure changes
  legend: VizLegendOptions;
  //onLegendClick?: (event: GraphNGLegendEvent) => void;
  children?: (builder: UPlotConfigBuilder, frame: DataFrame) => React.ReactNode;

  bucketSize?: number | null;
  //prepConfig: (frame: DataFrame) => UPlotConfigBuilder;
  //propsToDiff?: string[];
  //renderLegend: (config: UPlotConfigBuilder) => React.ReactElement;
}

const prepConfig = (frame: DataFrame, theme: GrafanaTheme2) => {
  // todo: scan all values in BucketMin and BucketMax fields to assert if uniform bucketSize

  let builder = new UPlotConfigBuilder();

  // assumes BucketMin is fields[0] and BucktMax is fields[1]
  let bucketSize = frame.fields[1].values.get(0) - frame.fields[0].values.get(0);

  builder.addScale({
    scaleKey: 'x', // bukkits
    isTime: false,
    distribution: ScaleDistribution.Linear,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
  });

  builder.addScale({
    scaleKey: 'y', // counts
    isTime: false,
    distribution: ScaleDistribution.Linear,
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
  });

  builder.addAxis({
    scaleKey: 'x',
    isTime: false,
    placement: AxisPlacement.Bottom,
    //splits: config.xSplits,
    //values: config.xValues,
    //grid: false,
    //ticks: false,
    //gap: 15,
    theme,
  });

  builder.addAxis({
    scaleKey: 'y',
    isTime: false,
    placement: AxisPlacement.Left,
    //splits: config.xSplits,
    //values: config.xValues,
    //grid: false,
    //ticks: false,
    //gap: 15,
    theme,
  });

  let pathBuilder = uPlot.paths.stepped!({ align: 1 });

  let seriesIndex = 0;

  // assumes BucketMax is [1]
  for (let i = 2; i < frame.fields.length; i++) {
    const field = frame.fields[i];

    field.state!.seriesIndex = seriesIndex++;

    const customConfig = { ...field.config.custom };

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
      show: !customConfig.hideFrom?.graph,
      gradientMode: customConfig.gradientMode,
      thresholds: field.config.thresholds,

      // The following properties are not used in the uPlot config, but are utilized as transport for legend config
      // dataFrameFieldIndex: {
      //   fieldIndex: i,
      //   frameIndex: 0,
      // },
      fieldName: getFieldDisplayName(field, frame),
      hideInLegend: customConfig.hideFrom?.legend,
    });
  }

  return builder;
};

const propsToDiff = ['bucketSize'];

const preparePlotData = (frame: DataFrame) => {
  let data: AlignedData = [];

  for (const field of frame.fields) {
    if (field.name !== 'BucketMax') {
      data.push(field.values.toArray());
    }
  }

  return data;
};

const renderLegend = (config: UPlotConfigBuilder) => {
  return null;
};

export function sameProps(prevProps: any, nextProps: any, propsToDiff: string[] = []) {
  for (const propName of propsToDiff) {
    if (nextProps[propName] !== prevProps[propName]) {
      return false;
    }
  }

  return true;
}

/**
 * @internal -- not a public API
 */
export interface GraphNGState {
  alignedFrame: DataFrame;
  alignedData: AlignedData;
  config?: UPlotConfigBuilder;
}

class UnthemedHistogram extends React.Component<HistogramProps, GraphNGState> {
  constructor(props: HistogramProps) {
    super(props);
    this.state = this.prepState(props);
  }

  prepState(props: HistogramProps, withConfig = true) {
    let state: GraphNGState = null as any;

    const { frames, bucketSize } = props;

    const alignedFrame = preparePlotFrame(frames, bucketSize);

    if (alignedFrame) {
      state = {
        alignedFrame,
        alignedData: preparePlotData(alignedFrame),
      };

      if (withConfig) {
        state.config = prepConfig(alignedFrame, this.props.theme);
      }
    }

    return state;
  }

  componentDidUpdate(prevProps: HistogramProps) {
    const { frames, structureRev } = this.props;

    const propsChanged = !sameProps(prevProps, this.props, propsToDiff);

    if (frames !== prevProps.frames || propsChanged) {
      let newState = this.prepState(this.props, false);

      if (newState) {
        const shouldReconfig =
          this.state.config === undefined || structureRev !== prevProps.structureRev || !structureRev || propsChanged;

        if (shouldReconfig) {
          newState.config = prepConfig(newState.alignedFrame, this.props.theme);
        }
      }

      newState && this.setState(newState);
    }
  }

  render() {
    const { width, height, children } = this.props;
    const { config, alignedFrame } = this.state;

    if (!config) {
      return null;
    }

    console.log(this.state.alignedData);

    return (
      <VizLayout width={width} height={height} legend={renderLegend(config)}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            config={this.state.config!}
            data={this.state.alignedData}
            width={vizWidth}
            height={vizHeight}
            timeRange={null}
          >
            {children ? children(config, alignedFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}

export const Histogram = withTheme2(UnthemedHistogram);
Histogram.displayName = 'Histogram';
