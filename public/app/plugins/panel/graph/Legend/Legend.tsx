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

  onToggleSeries(series: TimeSeries, event: Event) {
    // const scrollPosition = legendScrollbar.scroller.scrollTop;
    this.props.onToggleSeries(series, event);
    // legendScrollbar.scroller.scrollTop = scrollPosition;
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
      onToggleSeries: (s, e) => this.onToggleSeries(s, e),
      onToggleSort: (sortBy, sortDesc) => this.props.onToggleSort(sortBy, sortDesc),
      onColorChange: (series, color) => this.props.onColorChange(series, color),
      onToggleAxis: series => this.props.onToggleAxis(series),
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
    return seriesList.map((series, i) => (
      <LegendItem
        key={series.id}
        series={series}
        index={i}
        hiddenSeries={hiddenSeries}
        {...seriesValuesProps}
        onLabelClick={e => this.props.onToggleSeries(series, e)}
        onColorChange={color => this.props.onColorChange(series, color)}
        onToggleAxis={() => this.props.onToggleAxis(series)}
      />
    ));
  }
}

class LegendTable extends React.PureComponent<Partial<GraphLegendProps>> {
  onToggleSort(stat) {
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
  }

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
                  <LegendTableHeaderItem
                    key={statName}
                    statName={statName}
                    sort={sort}
                    sortDesc={sortDesc}
                    onClick={e => this.onToggleSort(statName)}
                  />
                )
            )}
          </tr>
          {seriesList.map((series, i) => (
            <LegendItem
              key={series.id}
              asTable={true}
              series={series}
              index={i}
              hiddenSeries={this.props.hiddenSeries}
              onLabelClick={e => this.props.onToggleSeries(series, e)}
              onColorChange={color => this.props.onColorChange(series, color)}
              onToggleAxis={() => this.props.onToggleAxis(series)}
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
  onClick?: (event) => void;
}

function LegendTableHeaderItem(props: LegendTableHeaderProps & LegendSortProps) {
  const { statName, sort, sortDesc } = props;
  return (
    <th className="pointer" onClick={e => props.onClick(e)}>
      {statName}
      {sort === statName && <span className={sortDesc ? 'fa fa-caret-down' : 'fa fa-caret-up'} />}
    </th>
  );
}

export class Legend extends React.Component<GraphLegendProps> {
  render() {
    return (
      <CustomScrollbar>
        <GraphLegend {...this.props} />
      </CustomScrollbar>
    );
  }
}

export default Legend;
