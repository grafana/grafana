import _ from 'lodash';
import React from 'react';

const LEGEND_STATS = ['min', 'max', 'avg', 'current', 'total'];

export interface GraphLegendProps {
  seriesList: any[];
  hiddenSeries: any;
  values?: boolean;
  min?: boolean;
  max?: boolean;
  avg?: boolean;
  current?: boolean;
  total?: boolean;
  alignAsTable?: boolean;
  rightSide?: boolean;
  sideWidth?: number;
  sort?: 'min' | 'max' | 'avg' | 'current' | 'total';
  sortDesc?: boolean;
  className?: string;
}

export interface GraphLegendState {}

export class GraphLegend extends React.PureComponent<GraphLegendProps, GraphLegendState> {
  sortLegend() {
    let seriesList = this.props.seriesList || [];
    if (this.props.sort) {
      seriesList = _.sortBy(seriesList, function(series) {
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
    const { className, hiddenSeries, rightSide, sideWidth } = this.props;
    const { values, min, max, avg, current, total } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    const seriesList = this.sortLegend();
    const legendCustomClasses = `${this.props.alignAsTable ? 'graph-legend-table' : ''} ${className}`;

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
            seriesList.map((series, i) => (
              <LegendSeriesItem
                key={series.id}
                series={series}
                index={i}
                hiddenSeries={hiddenSeries}
                {...seriesValuesProps}
              />
            ))
          )}
        </div>
      </div>
    );
  }
}

interface LegendSeriesItemProps {
  series: any;
  index: number;
  hiddenSeries: any;
  values?: boolean;
  min?: boolean;
  max?: boolean;
  avg?: boolean;
  current?: boolean;
  total?: boolean;
}

class LegendSeriesItem extends React.Component<LegendSeriesItemProps> {
  constructor(props) {
    super(props);
  }

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

function LegendSeriesLabel(props: LegendSeriesLabelProps) {
  const { label, color } = props;
  return (
    <div>
      <div className="graph-legend-icon">
        <i className="fa fa-minus pointer" style={{ color: color }} />
      </div>
      <a className="graph-legend-alias pointer" title={label}>
        {label}
      </a>
    </div>
  );
}

function LegendValue(props) {
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

interface LegendTableProps {
  seriesList: any[];
  hiddenSeries: any;
  values?: boolean;
  min?: boolean;
  max?: boolean;
  avg?: boolean;
  current?: boolean;
  total?: boolean;
}

class LegendTable extends React.PureComponent<LegendTableProps> {
  render() {
    const seriesList = this.props.seriesList;
    const { values, min, max, avg, current, total } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };

    return (
      <table>
        <tbody>
          <tr>
            <th style={{ textAlign: 'left' }} />
            {LEGEND_STATS.map(
              statName => seriesValuesProps[statName] && <LegendTableHeader key={statName} statName={statName} />
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

class LegendSeriesItemAsTable extends React.Component<LegendSeriesItemProps> {
  constructor(props) {
    super(props);
  }

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

interface LegendTableHeaderProps {
  statName: string;
  sortDesc?: boolean;
}

function LegendTableHeader(props: LegendTableHeaderProps) {
  return (
    <th className="pointer" data-stat={props.statName}>
      {props.statName}
      <span className={props.sortDesc ? 'fa fa-caret-down' : 'fa fa-caret-up'} />
    </th>
  );
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
