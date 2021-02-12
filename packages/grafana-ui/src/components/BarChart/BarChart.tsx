import React from 'react';
import {
  compareArrayValues,
  compareDataFrameStructures,
  DataFrame,
  DisplayValue,
  fieldReducers,
  reduceField,
  TimeRange,
} from '@grafana/data';
import { VizLayout } from '../VizLayout/VizLayout';
import { Themeable } from '../../types';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent } from '../GraphNG/types';
import { BarChartOptions } from './types';
import { AlignedData } from 'uplot';
import { withTheme } from '../../themes';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { preparePlotData } from '../uPlot/utils';
import { LegendDisplayMode, VizLegendItem } from '../VizLegend/types';
import { VizLegend } from '../VizLegend/VizLegend';
import { mapMouseEventToMode } from '../GraphNG/utils';

/**
 * @alpha
 */
export interface BarChartProps extends Themeable, BarChartOptions {
  height: number;
  width: number;
  data: DataFrame[];
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
}

interface BarChartState {
  data: AlignedData;
  alignedDataFrame: DataFrame;
  config?: UPlotConfigBuilder;
}

class UnthemedBarChart extends React.Component<BarChartProps, BarChartState> {
  constructor(props: BarChartProps) {
    super(props);
    this.state = {} as BarChartState;
  }

  static getDerivedStateFromProps(props: BarChartProps, state: BarChartState) {
    const frame = preparePlotFrame(props.data);

    if (!frame) {
      return { ...state };
    }

    return {
      ...state,
      data: preparePlotData(frame),
      alignedDataFrame: frame,
    };
  }

  componentDidMount() {
    const { alignedDataFrame } = this.state;

    if (!alignedDataFrame) {
      return;
    }

    this.setState({
      config: preparePlotConfigBuilder(alignedDataFrame, this.props.theme, this.props),
    });
  }

  componentDidUpdate(prevProps: BarChartProps) {
    const { data, orientation, groupWidth, barWidth, showValue } = this.props;
    const { alignedDataFrame } = this.state;
    let shouldConfigUpdate = false;
    let hasStructureChanged = false;

    if (
      this.state.config === undefined ||
      orientation !== prevProps.orientation ||
      groupWidth !== prevProps.groupWidth ||
      barWidth !== prevProps.barWidth ||
      showValue !== prevProps.showValue
    ) {
      shouldConfigUpdate = true;
    }

    if (data !== prevProps.data) {
      if (!alignedDataFrame) {
        return;
      }
      hasStructureChanged = !compareArrayValues(data, prevProps.data, compareDataFrameStructures);
    }

    if (shouldConfigUpdate || hasStructureChanged) {
      this.setState({
        config: preparePlotConfigBuilder(alignedDataFrame, this.props.theme, this.props),
      });
    }
  }

  onLegendLabelClick = (legend: VizLegendItem, event: React.MouseEvent) => {
    const { onLegendClick } = this.props;
    const { fieldIndex } = legend;

    if (!onLegendClick || !fieldIndex) {
      return;
    }

    onLegendClick({
      fieldIndex,
      mode: mapMouseEventToMode(event),
    });
  };

  renderLegend() {
    const { legend, onSeriesColorChange, data } = this.props;
    const { config } = this.state;
    const hasLegend = legend && legend.displayMode !== LegendDisplayMode.Hidden;

    if (!config || !hasLegend) {
      return;
    }

    const legendItems = config
      .getSeries()
      .map<VizLegendItem | undefined>((s) => {
        const seriesConfig = s.props;
        const fieldIndex = seriesConfig.dataFrameFieldIndex;
        if (seriesConfig.hideInLegend || !fieldIndex) {
          return undefined;
        }

        const field = data[fieldIndex.frameIndex].fields[fieldIndex.fieldIndex];

        if (!field) {
          return undefined;
        }

        return {
          disabled: !seriesConfig.show ?? false,
          fieldIndex,
          color: seriesConfig.lineColor!,
          label: seriesConfig.fieldName,
          yAxis: 1,
          getDisplayValues: () => {
            if (!legend.calcs?.length) {
              return [];
            }

            const fieldCalcs = reduceField({
              field,
              reducers: legend.calcs,
            });

            return legend.calcs.map<DisplayValue>((reducer) => {
              return {
                ...field.display!(fieldCalcs[reducer]),
                title: fieldReducers.get(reducer).name,
              };
            });
          },
        };
      })
      .filter((i) => i !== undefined) as VizLegendItem[];

    return (
      <VizLayout.Legend position={legend.placement} maxHeight="35%" maxWidth="60%">
        <VizLegend
          onLabelClick={this.onLegendLabelClick}
          placement={legend.placement}
          items={legendItems}
          displayMode={legend.displayMode}
          onSeriesColorChange={onSeriesColorChange}
        />
      </VizLayout.Legend>
    );
  }

  render() {
    const { width, height } = this.props;
    const { config, data } = this.state;

    if (!config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={this.renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            data={data}
            config={config}
            width={vizWidth}
            height={vizHeight}
            timeRange={({ from: 1, to: 1 } as unknown) as TimeRange} // HACK
          />
        )}
      </VizLayout>
    );
  }
}

export const BarChart = withTheme(UnthemedBarChart);
BarChart.displayName = 'GraphNG';
