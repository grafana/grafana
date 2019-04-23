import React from 'react';
import { GraphSeriesXY, PanelData } from '@grafana/ui';
import difference from 'lodash/difference';
import { getGraphSeriesModel } from './getGraphSeriesModel';
import { Options, SeriesOptions } from './types';
import { SeriesColorChangeHandler, SeriesAxisToggleHandler } from '@grafana/ui/src/components/Graph/GraphWithLegend';

interface GraphPanelControllerAPI {
  series: GraphSeriesXY[];
  onSeriesAxisToggle: SeriesAxisToggleHandler;
  onSeriesColorChange: SeriesColorChangeHandler;
  onSeriesToggle: (label: string, event: React.MouseEvent<HTMLElement>) => void;
  onToggleSort: (sortBy: string) => void;
}

interface GraphPanelControllerProps {
  children: (api: GraphPanelControllerAPI) => JSX.Element;
  options: Options;
  data: PanelData;
  onOptionsChange: (options: Options) => void;
}

interface GraphPanelControllerState {
  graphSeriesModel: GraphSeriesXY[];
  hiddenSeries: string[];
}

export class GraphPanelController extends React.Component<GraphPanelControllerProps, GraphPanelControllerState> {
  constructor(props: GraphPanelControllerProps) {
    super(props);

    this.onSeriesToggle = this.onSeriesToggle.bind(this);
    this.onSeriesColorChange = this.onSeriesColorChange.bind(this);
    this.onSeriesAxisToggle = this.onSeriesAxisToggle.bind(this);
    this.onToggleSort = this.onToggleSort.bind(this);

    this.state = {
      graphSeriesModel: getGraphSeriesModel(
        props.data,
        props.options.series,
        props.options.graph,
        props.options.legend
      ),
      hiddenSeries: [],
    };
  }

  static getDerivedStateFromProps(props: GraphPanelControllerProps, state: GraphPanelControllerState) {
    return {
      ...state,
      graphSeriesModel: getGraphSeriesModel(
        props.data,
        props.options.series,
        props.options.graph,
        props.options.legend
      ),
    };
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

  onSeriesAxisToggle(label: string, yAxis: number) {
    const {
      options: { series },
    } = this.props;
    const seriesOptionsUpdate: SeriesOptions = series[label]
      ? {
          ...series[label],
          yAxis,
        }
      : {
          yAxis,
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

  onToggleSort(sortBy: string) {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      legend: {
        ...options.legend,
        sortBy,
        sortDesc: sortBy === options.legend.sortBy ? !options.legend.sortDesc : false,
      },
    });
  }

  onSeriesToggle(label: string, event: React.MouseEvent<HTMLElement>) {
    const { hiddenSeries, graphSeriesModel } = this.state;

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      // Toggling series with key makes the series itself to toggle
      if (hiddenSeries.indexOf(label) > -1) {
        this.setState({
          hiddenSeries: hiddenSeries.filter(series => series !== label),
        });
      } else {
        this.setState({
          hiddenSeries: hiddenSeries.concat([label]),
        });
      }
    } else {
      // Toggling series with out key toggles all the series but the clicked one
      const allSeriesLabels = graphSeriesModel.map(series => series.label);

      if (hiddenSeries.length + 1 === allSeriesLabels.length) {
        this.setState({ hiddenSeries: [] });
      } else {
        this.setState({
          hiddenSeries: difference(allSeriesLabels, [label]),
        });
      }
    }
  }

  render() {
    const { children } = this.props;
    const { graphSeriesModel, hiddenSeries } = this.state;

    return children({
      series: graphSeriesModel.map(series => ({
        ...series,
        isVisible: hiddenSeries.indexOf(series.label) === -1,
      })),
      onSeriesToggle: this.onSeriesToggle,
      onSeriesColorChange: this.onSeriesColorChange,
      onSeriesAxisToggle: this.onSeriesAxisToggle,
      onToggleSort: this.onToggleSort,
    });
  }
}
