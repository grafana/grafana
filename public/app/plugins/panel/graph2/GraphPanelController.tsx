import React from 'react';
import { GraphSeriesXY, SeriesData } from '@grafana/ui';
import union from 'lodash/union';
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
  data: SeriesData[];
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
    this.onSeriesHide = this.onSeriesHide.bind(this);
    this.onSeriesShow = this.onSeriesShow.bind(this);
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

  onSeriesHide(seriesToHide: string[]) {
    const hiddenSeries = union(this.state.hiddenSeries, seriesToHide);
    this.setState({
      hiddenSeries,
      graphSeriesModel: this.state.graphSeriesModel.map(series => {
        return {
          ...series,
          isVisible: hiddenSeries.indexOf(series.label) === -1,
        };
      }),
    });
  }

  onSeriesShow(seriesToShow: string[]) {
    this.setState({
      hiddenSeries: difference(this.state.hiddenSeries, seriesToShow),
    });
  }

  onSeriesToggle(label: string, event: React.MouseEvent<HTMLElement>) {
    const { hiddenSeries } = this.state;
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
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
      // TODO
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
