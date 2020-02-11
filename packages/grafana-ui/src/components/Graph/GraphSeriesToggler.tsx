import React from 'react';
import { GraphSeriesXY } from '@grafana/data';
import difference from 'lodash/difference';
import isEqual from 'lodash/isEqual';

export interface GraphSeriesTogglerAPI {
  onSeriesToggle: (label: string, event: React.MouseEvent<HTMLElement>) => void;
  toggledSeries: GraphSeriesXY[];
}

export interface GraphSeriesTogglerProps {
  children: (api: GraphSeriesTogglerAPI) => JSX.Element;
  series: GraphSeriesXY[];
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
}

export interface GraphSeriesTogglerState {
  hiddenSeries: string[];
  toggledSeries: GraphSeriesXY[];
}

export class GraphSeriesToggler extends React.Component<GraphSeriesTogglerProps, GraphSeriesTogglerState> {
  constructor(props: GraphSeriesTogglerProps) {
    super(props);

    this.onSeriesToggle = this.onSeriesToggle.bind(this);

    this.state = {
      hiddenSeries: [],
      toggledSeries: props.series,
    };
  }

  componentDidUpdate(prevProps: Readonly<GraphSeriesTogglerProps>) {
    const { series } = this.props;
    if (!isEqual(prevProps.series, series)) {
      this.setState({ hiddenSeries: [], toggledSeries: series });
    }
  }

  onSeriesToggle(label: string, event: React.MouseEvent<HTMLElement>) {
    const { series, onHiddenSeriesChanged } = this.props;
    const { hiddenSeries } = this.state;

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      // Toggling series with key makes the series itself to toggle
      const newHiddenSeries =
        hiddenSeries.indexOf(label) > -1
          ? hiddenSeries.filter(series => series !== label)
          : hiddenSeries.concat([label]);

      const toggledSeries = series.map(series => ({
        ...series,
        isVisible: newHiddenSeries.indexOf(series.label) === -1,
      }));
      this.setState({ hiddenSeries: newHiddenSeries, toggledSeries }, () =>
        onHiddenSeriesChanged ? onHiddenSeriesChanged(newHiddenSeries) : undefined
      );
      return;
    }

    // Toggling series with out key toggles all the series but the clicked one
    const allSeriesLabels = series.map(series => series.label);
    const newHiddenSeries =
      hiddenSeries.length + 1 === allSeriesLabels.length ? [] : difference(allSeriesLabels, [label]);
    const toggledSeries = series.map(series => ({
      ...series,
      isVisible: newHiddenSeries.indexOf(series.label) === -1,
    }));

    this.setState({ hiddenSeries: newHiddenSeries, toggledSeries }, () =>
      onHiddenSeriesChanged ? onHiddenSeriesChanged(newHiddenSeries) : undefined
    );
  }

  render() {
    const { children } = this.props;
    const { toggledSeries } = this.state;

    return children({
      onSeriesToggle: this.onSeriesToggle,
      toggledSeries,
    });
  }
}
