import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import { TimeSeries } from 'app/core/core';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';
import Drop from 'tether-drop';
import { ColorPickerPopover } from 'app/core/components/colorpicker/ColorPickerPopover';

const LEGEND_STATS = ['min', 'max', 'avg', 'current', 'total'];

interface LegendProps {
  seriesList: TimeSeries[];
  optionalClass?: string;
  onToggleSeries?: (series: TimeSeries, event: Event) => void;
  onToggleSort?: (sortBy, sortDesc) => void;
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
      <LegendSeriesItem
        key={series.id}
        series={series}
        index={i}
        hiddenSeries={hiddenSeries}
        {...seriesValuesProps}
        onLabelClick={e => this.props.onToggleSeries(series, e)}
        onColorChange={color => this.props.onColorChange(series, color)}
      />
    ));
  }
}

interface LegendSeriesProps {
  series: TimeSeries;
  index: number;
  onLabelClick?: (event) => void;
  onColorChange?: (color: string) => void;
}

type LegendSeriesItemProps = LegendSeriesProps & LegendDisplayProps & LegendValuesProps;

class LegendSeriesItem extends React.PureComponent<LegendSeriesItemProps> {
  render() {
    const { series, index, hiddenSeries } = this.props;
    const seriesOptionClasses = getOptionSeriesCSSClasses(series, hiddenSeries);
    const valueItems = this.props.values ? renderLegendValues(this.props, series) : [];
    return (
      <div className={`graph-legend-series ${seriesOptionClasses}`} data-series-index={index}>
        <LegendSeriesLabel
          label={series.aliasEscaped}
          color={series.color}
          onLabelClick={e => this.props.onLabelClick(e)}
          onColorChange={e => this.props.onColorChange(e)}
        />
        {valueItems}
      </div>
    );
  }
}

interface LegendSeriesLabelProps {
  label: string;
  color: string;
  onLabelClick?: (event) => void;
  onColorChange?: (color: string) => void;
}

class LegendSeriesLabel extends React.PureComponent<LegendSeriesLabelProps> {
  pickerElem: any;
  colorPickerDrop: any;

  openColorPicker() {
    if (this.colorPickerDrop) {
      this.destroyDrop();
    }

    const dropContent = <ColorPickerPopover color={this.props.color} onColorSelect={this.props.onColorChange} />;
    const dropContentElem = document.createElement('div');
    ReactDOM.render(dropContent, dropContentElem);

    const drop = new Drop({
      target: this.pickerElem,
      content: dropContentElem,
      position: 'top center',
      classes: 'drop-popover',
      openOn: 'hover',
      hoverCloseDelay: 200,
      remove: true,
      tetherOptions: {
        constraints: [{ to: 'scrollParent', attachment: 'none both' }],
      },
    });

    drop.on('close', this.closeColorPicker.bind(this));

    this.colorPickerDrop = drop;
    this.colorPickerDrop.open();
  }

  closeColorPicker() {
    setTimeout(() => {
      this.destroyDrop();
    }, 100);
  }

  destroyDrop() {
    if (this.colorPickerDrop && this.colorPickerDrop.tether) {
      this.colorPickerDrop.destroy();
      this.colorPickerDrop = null;
    }
  }

  render() {
    const { label, color } = this.props;
    return [
      <div
        key="icon"
        className="graph-legend-icon"
        ref={e => (this.pickerElem = e)}
        onClick={() => this.openColorPicker()}
      >
        <i className="fa fa-minus pointer" style={{ color: color }} />
      </div>,
      <a className="graph-legend-alias pointer" title={label} key="label" onClick={e => this.props.onLabelClick(e)}>
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

function renderLegendValues(props: LegendSeriesItemProps, series, asTable = false) {
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
            <LegendSeriesItemAsTable
              key={series.id}
              series={series}
              index={i}
              hiddenSeries={this.props.hiddenSeries}
              {...seriesValuesProps}
              onLabelClick={e => this.props.onToggleSeries(series, e)}
              onColorChange={color => this.props.onColorChange(series, color)}
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
    <th className="pointer" data-stat={statName} onClick={e => props.onClick(e)}>
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
          <LegendSeriesLabel
            label={series.aliasEscaped}
            color={series.color}
            onLabelClick={e => this.props.onLabelClick(e)}
            onColorChange={e => this.props.onColorChange(e)}
          />
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
  if (hiddenSeries[series.alias] && hiddenSeries[series.alias] === true) {
    classes.push('graph-legend-series-hidden');
  }
  return classes.join(' ');
}

export class Legend extends React.Component<GraphLegendProps, GraphLegendState> {
  render() {
    return (
      <CustomScrollbar>
        <GraphLegend {...this.props} />
      </CustomScrollbar>
    );
  }
}

export default Legend;
