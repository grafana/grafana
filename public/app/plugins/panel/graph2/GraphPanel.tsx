import React from 'react';
import { PanelProps, GraphWithLegend, LegendTable, LegendList } from '@grafana/ui';
import { Options, SeriesOptions } from './types';
import { getGraphSeriesModel } from './getGraphSeriesModel';

interface GraphPanelProps extends PanelProps<Options> {}

export class GraphPanel extends React.Component<GraphPanelProps> {
  constructor(props: GraphPanelProps) {
    super(props);
    this.onSeriesColorChange = this.onSeriesColorChange.bind(this);
    this.onSeriesAxisToggle = this.onSeriesAxisToggle.bind(this);
  }

  onSeriesOptionsUpdate(label: string, optionsUpdate: SeriesOptions) {
    const { onOptionsChange, options } = this.props;
    const updatedSeriesOptions: { [label: string]: SeriesOptions } = { ...options.series };
    updatedSeriesOptions[label] = optionsUpdate;
    onOptionsChange({
      ...options,
      series: updatedSeriesOptions,
    });
  }

  onSeriesAxisToggle(label: string, useRightYAxis: boolean) {
    const {
      options: { series },
    } = this.props;
    const seriesOptionsUpdate: SeriesOptions = series[label]
      ? {
          ...series[label],
          useRightYAxis,
        }
      : {
          useRightYAxis,
        };
    this.onSeriesOptionsUpdate(label, seriesOptionsUpdate);
  }

  onSeriesColorChange(label: string, color: string) {
    const {
      options: { series },
    } = this.props;
    const seriesOptionsUpdate: SeriesOptions = series[label]
      ? {
          ...series[label],
          color,
        }
      : {
          color,
        };

    this.onSeriesOptionsUpdate(label, seriesOptionsUpdate);
  }

  render() {
    const { data, timeRange, width, height, options } = this.props;
    if (!data) {
      return (
        <div className="panel-empty">
          <p>No data found in response</p>
        </div>
      );
    }

    const {
      graph: { showLines, showBars, showPoints },
      legend: legendOptions,
      series,
    } = options;

    const graphProps = {
      showBars,
      showLines,
      showPoints,
    };
    const { asTable, isVisible, ...legendProps } = legendOptions;

    return (
      <GraphWithLegend
        series={getGraphSeriesModel(data, legendOptions.stats, series)}
        timeRange={timeRange}
        width={width}
        height={height}
        renderLegendAs={asTable ? LegendTable : LegendList}
        isLegendVisible={isVisible}
        onSeriesColorChange={this.onSeriesColorChange}
        onSeriesAxisToggle={this.onSeriesAxisToggle}
        {...graphProps}
        {...legendProps}
      />
    );
  }
}
