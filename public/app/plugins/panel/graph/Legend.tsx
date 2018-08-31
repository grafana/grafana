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
    const { className = '', hiddenSeries } = this.props;
    const { values, min, max, avg, current, total } = this.props;
    const seriesValuesProps = { values, min, max, avg, current, total };
    const seriesList = this.sortLegend();
    return (
      <div className={`${className} graph-legend`}>
        <div className={`graph-legend-content ${this.props.alignAsTable ? 'graph-legend-table' : ''}`}>
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
      </div>
    );
  }
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
    const headerStyle: React.CSSProperties = {
      textAlign: 'left',
    };

    return (
      <tbody>
        <tr>
          <th colSpan={2} style={headerStyle} />
          {LEGEND_STATS.map(
            statName => seriesValuesProps[statName] && <LegendTableHeader key={statName} statName={statName} />
          )}
        </tr>
        {seriesList.map((series, i) => (
          <LegendSeriesItem
            key={series.id}
            series={series}
            index={i}
            hiddenSeries={this.props.hiddenSeries}
            {...seriesValuesProps}
          />
        ))}
      </tbody>
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
        <div className="graph-legend-icon">
          <i className="fa fa-minus pointer" style={{ color: series.color }} />
        </div>
        <a className="graph-legend-alias pointer" title={series.aliasEscaped}>
          {series.aliasEscaped}
        </a>
        {valueItems}
      </div>
    );
  }
}

function LegendValue(props) {
  const value = props.value;
  const valueName = props.valueName;
  return <div className={`graph-legend-value ${valueName}`}>{value}</div>;
}

function renderLegendValues(props: LegendSeriesItemProps, series) {
  const legendValueItems = [];
  for (const valueName of LEGEND_STATS) {
    if (props[valueName]) {
      const valueFormatted = series.formatValue(series.stats[valueName]);
      legendValueItems.push(<LegendValue key={valueName} valueName={valueName} value={valueFormatted} />);
    }
  }
  return legendValueItems;
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
