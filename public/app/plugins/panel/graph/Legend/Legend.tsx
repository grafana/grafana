import _ from 'lodash';
import React from 'react';
import { TimeSeries } from 'app/core/core';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';
import { LegendItem, LEGEND_STATS } from './LegendSeriesItem';

interface LegendProps {
  seriesList: TimeSeries[];
  optionalClass?: string;
  onToggleSeries?: (series: TimeSeries, event: Event) => void;
  onToggleSort?: (sortBy, sortDesc) => void;
  onToggleAxis?: (series: TimeSeries) => void;
  onColorChange?: (series: TimeSeries, color: string) => void;
}

interface LegendDisplayProps {
  hiddenSeries: any;
  hideEmpty?: boolean;
  hideZero?: boolean;
  alignAsTable?: boolean;
  rightSide?: boolean;
  sideWidth?: number;
}

interface LegendValuesProps {
  values?: boolean;
  min?: boolean;
  max?: boolean;
  avg?: boolean;
  current?: boolean;
  total?: boolean;
}

interface LegendSortProps {
  sort?: 'min' | 'max' | 'avg' | 'current' | 'total';
  sortDesc?: boolean;
}

export type GraphLegendProps = LegendProps & LegendDisplayProps & LegendValuesProps & LegendSortProps;

export class GraphLegend extends React.PureComponent<GraphLegendProps> {
  static defaultProps: Partial<GraphLegendProps> = {
    values: false,
    min: false,
    max: false,
    avg: false,
    current: false,
    total: false,
    alignAsTable: false,
    rightSide: false,
    sort: undefined,
    sortDesc: false,
    optionalClass: '',
    onToggleSeries: () => {},
    onToggleSort: () => {},
    onToggleAxis: () => {},
    onColorChange: () => {},
  };

  onToggleSeries = (series, event) => {
    this.props.onToggleSeries(series, event);
    this.forceUpdate();
  };

  onToggleAxis = series => {
    this.props.onToggleAxis(series);
    this.forceUpdate();
  };

  onColorChange = (series, color) => {
    this.props.onColorChange(series, color);
    this.forceUpdate();
  };

  sortLegend() {
    let seriesList = this.props.seriesList || [];
    if (this.props.sort) {
      seriesList = _.sortBy(seriesList, series => {
        let sort = series.stats[this.props.sort];
        if (sort === null) {
          sort = -Infinity;
        }
        return sort;
      });
      if (this.props.sortDesc) {
        seriesList = seriesList.reverse();
      }
    }
    return seriesList;
  }

  render() {
    const { optionalClass, hiddenSeries, rightSide, sideWidth, sort, sortDesc, hideEmpty, hideZero } = this.props;
    const { values, min, max, avg, current, total } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    const seriesHideProps = { hideEmpty, hideZero };
    const sortProps = { sort, sortDesc };
    const seriesList = _.filter(this.sortLegend(), series => !series.hideFromLegend(seriesHideProps));
    const legendClass = `${this.props.alignAsTable ? 'graph-legend-table' : ''} ${optionalClass}`;

    // Set min-width if side style and there is a value, otherwise remove the CSS property
    // Set width so it works with IE11
    const width: any = rightSide && sideWidth ? sideWidth : undefined;
    const ieWidth: any = rightSide && sideWidth ? sideWidth - 1 : undefined;
    const legendStyle: React.CSSProperties = {
      minWidth: width,
      width: ieWidth,
    };

    const legendProps: GraphLegendProps = {
      seriesList: seriesList,
      hiddenSeries: hiddenSeries,
      onToggleSeries: this.onToggleSeries,
      onToggleAxis: this.onToggleAxis,
      onToggleSort: this.props.onToggleSort,
      onColorChange: this.onColorChange,
      ...seriesValuesProps,
      ...sortProps,
    };

    return (
      <div className={`graph-legend-content ${legendClass}`} style={legendStyle}>
        {this.props.alignAsTable ? <LegendTable {...legendProps} /> : <LegendSeriesList {...legendProps} />}
      </div>
    );
  }
}

class LegendSeriesList extends React.PureComponent<GraphLegendProps> {
  render() {
    const { seriesList, hiddenSeries, values, min, max, avg, current, total } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    return seriesList.map(series => (
      <LegendItem
        key={series.id}
        series={series}
        hidden={hiddenSeries[series.alias]}
        {...seriesValuesProps}
        onLabelClick={this.props.onToggleSeries}
        onColorChange={this.props.onColorChange}
        onToggleAxis={this.props.onToggleAxis}
      />
    ));
  }
}

class LegendTable extends React.PureComponent<Partial<GraphLegendProps>> {
  onToggleSort = stat => {
    let sortDesc = this.props.sortDesc;
    let sortBy = this.props.sort;
    if (stat !== sortBy) {
      sortDesc = null;
    }

    // if already sort ascending, disable sorting
    if (sortDesc === false) {
      sortBy = null;
      sortDesc = null;
    } else {
      sortDesc = !sortDesc;
      sortBy = stat;
    }
    this.props.onToggleSort(sortBy, sortDesc);
  };

  render() {
    const seriesList = this.props.seriesList;
    const { values, min, max, avg, current, total, sort, sortDesc, hiddenSeries } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    return (
      <table>
        <tbody>
          <tr>
            <th style={{ textAlign: 'left' }} />
            {LEGEND_STATS.map(
              statName =>
                seriesValuesProps[statName] && (
                  <LegendTableHeaderItem
                    key={statName}
                    statName={statName}
                    sort={sort}
                    sortDesc={sortDesc}
                    onClick={this.onToggleSort}
                  />
                )
            )}
          </tr>
          {seriesList.map(series => (
            <LegendItem
              key={series.id}
              asTable={true}
              series={series}
              hidden={hiddenSeries[series.alias]}
              onLabelClick={this.props.onToggleSeries}
              onColorChange={this.props.onColorChange}
              onToggleAxis={this.props.onToggleAxis}
              {...seriesValuesProps}
            />
          ))}
        </tbody>
      </table>
    );
  }
}

interface LegendTableHeaderProps {
  statName: string;
  onClick?: (statName: string) => void;
}

class LegendTableHeaderItem extends React.PureComponent<LegendTableHeaderProps & LegendSortProps> {
  onClick = () => this.props.onClick(this.props.statName);

  render() {
    const { statName, sort, sortDesc } = this.props;
    return (
      <th className="pointer" onClick={this.onClick}>
        {statName}
        {sort === statName && <span className={sortDesc ? 'fa fa-caret-down' : 'fa fa-caret-up'} />}
      </th>
    );
  }
}

export class Legend extends React.PureComponent<GraphLegendProps> {
  render() {
    return (
      <CustomScrollbar>
        <GraphLegend {...this.props} />
      </CustomScrollbar>
    );
  }
}

export default Legend;
