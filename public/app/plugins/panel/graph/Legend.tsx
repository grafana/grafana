import _ from 'lodash';
import React from 'react';
import { TimeSeries } from 'app/core/core';

const LEGEND_STATS = ['min', 'max', 'avg', 'current', 'total'];

interface LegendProps {
  seriesList: TimeSeries[];
  optionalClass?: string;
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

const defaultGraphLegendProps: Partial<GraphLegendProps> = {
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
};

export interface GraphLegendState {}

export class GraphLegend extends React.PureComponent<GraphLegendProps, GraphLegendState> {
  static defaultProps = defaultGraphLegendProps;

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
    const { optionalClass, hiddenSeries, rightSide, sideWidth, hideEmpty, hideZero } = this.props;
    const { values, min, max, avg, current, total } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    const seriesHideProps = { hideEmpty, hideZero };
    const seriesList = _.filter(this.sortLegend(), series => !series.hideFromLegend(seriesHideProps));
    const legendCustomClasses = `${this.props.alignAsTable ? 'graph-legend-table' : ''} ${optionalClass}`;

    // Set min-width if side style and there is a value, otherwise remove the CSS property
    // Set width so it works with IE11
    const width: any = rightSide && sideWidth ? sideWidth : undefined;
    const ieWidth: any = rightSide && sideWidth ? sideWidth - 1 : undefined;
    const legendStyle: React.CSSProperties = {
      minWidth: width,
      width: ieWidth,
    };

    return (
      <div className={`graph-legend-content ${legendCustomClasses}`} style={legendStyle}>
        <div className="graph-legend-scroll">
          {this.props.alignAsTable ? (
            <LegendTable seriesList={seriesList} hiddenSeries={hiddenSeries} {...seriesValuesProps} />
          ) : (
            <LegendSeriesList seriesList={seriesList} hiddenSeries={hiddenSeries} {...seriesValuesProps} />
          )}
        </div>
      </div>
    );
  }
}

class LegendSeriesList extends React.PureComponent<GraphLegendProps> {
  render() {
    const { seriesList, hiddenSeries, values, min, max, avg, current, total } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    return seriesList.map((series, i) => (
      <LegendSeriesItem key={series.id} series={series} index={i} hiddenSeries={hiddenSeries} {...seriesValuesProps} />
    ));
  }
}

interface LegendSeriesProps {
  series: TimeSeries;
  index: number;
}

type LegendSeriesItemProps = LegendSeriesProps & LegendDisplayProps & LegendValuesProps;

class LegendSeriesItem extends React.PureComponent<LegendSeriesItemProps> {
  render() {
    const { series, index, hiddenSeries } = this.props;
    const seriesOptionClasses = getOptionSeriesCSSClasses(series, hiddenSeries);
    const valueItems = this.props.values ? renderLegendValues(this.props, series) : [];
    return (
      <div className={`graph-legend-series ${seriesOptionClasses}`} data-series-index={index}>
        <LegendSeriesLabel label={series.aliasEscaped} color={series.color} />
        {valueItems}
      </div>
    );
  }
}

interface LegendSeriesLabelProps {
  label: string;
  color: string;
}

class LegendSeriesLabel extends React.PureComponent<LegendSeriesLabelProps> {
  render() {
    const { label, color } = this.props;
    return [
      <div className="graph-legend-icon" key="icon">
        <i className="fa fa-minus pointer" style={{ color: color }} />
      </div>,
      <a className="graph-legend-alias pointer" title={label} key="label">
        {label}
      </a>,
    ];
  }
}

interface LegendValueProps {
  value: string;
  valueName: string;
  asTable?: boolean;
}

function LegendValue(props: LegendValueProps) {
  const value = props.value;
  const valueName = props.valueName;
  if (props.asTable) {
    return <td className={`graph-legend-value ${valueName}`}>{value}</td>;
  }
  return <div className={`graph-legend-value ${valueName}`}>{value}</div>;
}

function renderLegendValues(props: LegendSeriesItemProps, series, asTable = false): React.ReactElement<any>[] {
  const legendValueItems = [];
  for (const valueName of LEGEND_STATS) {
    if (props[valueName]) {
      const valueFormatted = series.formatValue(series.stats[valueName]);
      legendValueItems.push(
        <LegendValue key={valueName} valueName={valueName} value={valueFormatted} asTable={asTable} />
      );
    }
  }
  return legendValueItems;
}

class LegendTable extends React.PureComponent<Partial<GraphLegendProps>> {
  render() {
    const seriesList = this.props.seriesList;
    const { values, min, max, avg, current, total, sort, sortDesc } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    return (
      <table>
        <tbody>
          <tr>
            <th style={{ textAlign: 'left' }} />
            {LEGEND_STATS.map(
              statName =>
                seriesValuesProps[statName] && (
                  <LegendTableHeader key={statName} statName={statName} sort={sort} sortDesc={sortDesc} />
                )
            )}
          </tr>
          {seriesList.map((series, i) => (
            <LegendSeriesItemAsTable
              key={series.id}
              series={series}
              index={i}
              hiddenSeries={this.props.hiddenSeries}
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
}

function LegendTableHeader(props: LegendTableHeaderProps & LegendSortProps) {
  const { statName, sort, sortDesc } = props;
  return (
    <th className="pointer" data-stat={statName}>
      {statName}
      {sort === statName && <span className={sortDesc ? 'fa fa-caret-down' : 'fa fa-caret-up'} />}
    </th>
  );
}

class LegendSeriesItemAsTable extends React.PureComponent<LegendSeriesItemProps> {
  render() {
    const { series, index, hiddenSeries } = this.props;
    const seriesOptionClasses = getOptionSeriesCSSClasses(series, hiddenSeries);
    const valueItems = this.props.values ? renderLegendValues(this.props, series, true) : [];
    return (
      <tr className={`graph-legend-series ${seriesOptionClasses}`} data-series-index={index}>
        <td>
          <LegendSeriesLabel label={series.aliasEscaped} color={series.color} />
        </td>
        {valueItems}
      </tr>
    );
  }
}

function getOptionSeriesCSSClasses(series, hiddenSeries) {
  const classes = [];
  if (series.yaxis === 2) {
    classes.push('graph-legend-series--right-y');
  }
  if (hiddenSeries[series.alias]) {
    classes.push('graph-legend-series-hidden');
  }
  return classes.join(' ');
}
