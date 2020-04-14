import _ from 'lodash';
import React, { PureComponent } from 'react';
import { TimeSeries } from 'app/core/core';
import { CustomScrollbar, Icon } from '@grafana/ui';
import { LegendItem, LEGEND_STATS } from './LegendSeriesItem';

type Sort = 'min' | 'max' | 'avg' | 'current' | 'total';
interface LegendProps {
  seriesList: TimeSeries[];
  optionalClass?: string;
}

interface LegendEventHandlers {
  onToggleSeries?: (hiddenSeries: any) => void;
  onToggleSort?: (sortBy: any, sortDesc: any) => void;
  onToggleAxis?: (series: TimeSeries) => void;
  onColorChange?: (series: TimeSeries, color: string) => void;
}

interface LegendComponentEventHandlers {
  onToggleSeries?: (series: TimeSeries, event: any) => void;
  onToggleSort?: (sortBy: Sort, sortDesc: any) => void;
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
  sort?: Sort;
  sortDesc?: boolean;
}

export type GraphLegendProps = LegendProps &
  LegendDisplayProps &
  LegendValuesProps &
  LegendSortProps &
  LegendEventHandlers;
export type LegendComponentProps = LegendProps &
  LegendDisplayProps &
  LegendValuesProps &
  LegendSortProps &
  LegendComponentEventHandlers;

interface LegendState {
  hiddenSeries: { [seriesAlias: string]: boolean };
}

export class GraphLegend extends PureComponent<GraphLegendProps, LegendState> {
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

  constructor(props: GraphLegendProps) {
    super(props);
    this.state = {
      hiddenSeries: this.props.hiddenSeries,
    };
  }

  sortLegend() {
    let seriesList: TimeSeries[] = [...this.props.seriesList] || [];
    if (this.props.sort && this.props[this.props.sort] && this.props.alignAsTable) {
      seriesList = _.sortBy(seriesList, series => {
        let sort = series.stats[this.props.sort];
        if (sort === null) {
          sort = -Infinity;
        }
        return sort;
      }) as TimeSeries[];
      if (this.props.sortDesc) {
        seriesList = seriesList.reverse();
      }
    }
    return seriesList;
  }

  onToggleSeries = (series: TimeSeries, event: any) => {
    let hiddenSeries = { ...this.state.hiddenSeries };
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      if (hiddenSeries[series.alias]) {
        delete hiddenSeries[series.alias];
      } else {
        hiddenSeries[series.alias] = true;
      }
    } else {
      hiddenSeries = this.toggleSeriesExclusiveMode(series);
    }
    this.setState({ hiddenSeries: hiddenSeries });
    this.props.onToggleSeries(hiddenSeries);
  };

  toggleSeriesExclusiveMode(series: TimeSeries) {
    const hiddenSeries = { ...this.state.hiddenSeries };

    if (hiddenSeries[series.alias]) {
      delete hiddenSeries[series.alias];
    }

    // check if every other series is hidden
    const alreadyExclusive = this.props.seriesList.every(value => {
      if (value.alias === series.alias) {
        return true;
      }

      return hiddenSeries[value.alias];
    });

    if (alreadyExclusive) {
      // remove all hidden series
      this.props.seriesList.forEach(value => {
        delete hiddenSeries[value.alias];
      });
    } else {
      // hide all but this serie
      this.props.seriesList.forEach(value => {
        if (value.alias === series.alias) {
          return;
        }

        hiddenSeries[value.alias] = true;
      });
    }

    return hiddenSeries;
  }

  render() {
    const {
      optionalClass,
      rightSide,
      sideWidth,
      sort,
      sortDesc,
      hideEmpty,
      hideZero,
      values,
      min,
      max,
      avg,
      current,
      total,
    } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    const hiddenSeries = this.state.hiddenSeries;
    const seriesHideProps = { hideEmpty, hideZero };
    const sortProps = { sort, sortDesc };
    const seriesList = this.sortLegend().filter(series => !series.hideFromLegend(seriesHideProps));
    const legendClass = `${this.props.alignAsTable ? 'graph-legend-table' : ''} ${optionalClass}`;

    // Set min-width if side style and there is a value, otherwise remove the CSS property
    // Set width so it works with IE11
    const width: any = rightSide && sideWidth ? sideWidth : undefined;
    const ieWidth: any = rightSide && sideWidth ? sideWidth - 1 : undefined;
    const legendStyle: React.CSSProperties = {
      minWidth: width,
      width: ieWidth,
    };

    const legendProps: LegendComponentProps = {
      seriesList: seriesList,
      hiddenSeries: hiddenSeries,
      onToggleSeries: this.onToggleSeries,
      onToggleAxis: this.props.onToggleAxis,
      onToggleSort: this.props.onToggleSort,
      onColorChange: this.props.onColorChange,
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

class LegendSeriesList extends PureComponent<LegendComponentProps> {
  render() {
    const { seriesList, hiddenSeries, values, min, max, avg, current, total } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    return seriesList.map((series, i) => (
      <LegendItem
        // This trick required because TimeSeries.id is not unique (it's just TimeSeries.alias).
        // In future would be good to make id unique across the series list.
        key={`${series.id}-${i}`}
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

class LegendTable extends PureComponent<Partial<LegendComponentProps>> {
  onToggleSort = (stat: Sort) => {
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
    const seriesValuesProps: any = { values, min, max, avg, current, total };
    return (
      <table>
        <colgroup>
          <col style={{ width: '100%' }} />
        </colgroup>
        <thead>
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
        </thead>
        <tbody>
          {seriesList.map((series, i) => (
            <LegendItem
              key={`${series.id}-${i}`}
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

class LegendTableHeaderItem extends PureComponent<LegendTableHeaderProps & LegendSortProps> {
  onClick = () => this.props.onClick(this.props.statName);

  render() {
    const { statName, sort, sortDesc } = this.props;
    return (
      <th className="pointer" onClick={this.onClick}>
        {statName}
        {sort === statName && <Icon name={sortDesc ? 'angle-down' : 'angle-up'} />}
      </th>
    );
  }
}

export class Legend extends PureComponent<GraphLegendProps> {
  render() {
    return (
      <CustomScrollbar hideHorizontalTrack>
        <GraphLegend {...this.props} />
      </CustomScrollbar>
    );
  }
}

export default Legend;
