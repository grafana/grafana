import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { TimeSeries } from 'app/core/core';
import { Icon, SeriesColorPicker } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

export const LEGEND_STATS = ['min', 'max', 'avg', 'current', 'total'];

export interface LegendLabelProps {
  series: TimeSeries;
  asTable?: boolean;
  hidden?: boolean;
  onLabelClick: (series: any, event: any) => void;
  onColorChange: (series: any, color: string) => void;
  onToggleAxis: (series: any) => void;
}

export interface LegendValuesProps {
  values?: boolean;
  min?: boolean;
  max?: boolean;
  avg?: boolean;
  current?: boolean;
  total?: boolean;
}

type LegendItemProps = LegendLabelProps & LegendValuesProps;

interface LegendItemState {
  yaxis: number;
}

export class LegendItem extends PureComponent<LegendItemProps, LegendItemState> {
  static defaultProps = {
    asTable: false,
    hidden: false,
    onLabelClick: () => {},
    onColorChange: () => {},
    onToggleAxis: () => {},
  };

  constructor(props: LegendItemProps) {
    super(props);
    this.state = {
      yaxis: this.props.series.yaxis,
    };
  }

  onLabelClick = (e: any) => this.props.onLabelClick(this.props.series, e);

  onToggleAxis = () => {
    const yaxis = this.state.yaxis === 2 ? 1 : 2;
    const info = { alias: this.props.series.alias, yaxis: yaxis };
    this.setState({ yaxis: yaxis });
    this.props.onToggleAxis(info);
  };

  onColorChange = (color: string) => {
    this.props.onColorChange(this.props.series, color);
    // Because of PureComponent nature it makes only shallow props comparison and changing of series.color doesn't run
    // component re-render. In this case we can't rely on color, selected by user, because it may be overwritten
    // by series overrides. So we need to use forceUpdate() to make sure we have proper series color.
    this.forceUpdate();
  };

  renderLegendValues() {
    const { series, asTable } = this.props;
    const legendValueItems = [];
    for (const valueName of LEGEND_STATS) {
      // @ts-ignore
      if (this.props[valueName]) {
        const valueFormatted = series.formatValue(series.stats[valueName]);
        legendValueItems.push(
          <LegendValue key={valueName} valueName={valueName} value={valueFormatted} asTable={asTable} />
        );
      }
    }
    return legendValueItems;
  }

  render() {
    const { series, values, asTable, hidden } = this.props;
    const seriesOptionClasses = classNames({
      'graph-legend-series-hidden': hidden,
      'graph-legend-series--right-y': series.yaxis === 2,
    });
    const valueItems = values ? this.renderLegendValues() : [];
    const seriesLabel = (
      <LegendSeriesLabel
        label={series.alias}
        color={series.color}
        yaxis={this.state.yaxis}
        onLabelClick={this.onLabelClick}
        onColorChange={this.onColorChange}
        onToggleAxis={this.onToggleAxis}
      />
    );

    if (asTable) {
      return (
        <tr className={`graph-legend-series ${seriesOptionClasses}`}>
          <td>{seriesLabel}</td>
          {valueItems}
        </tr>
      );
    } else {
      return (
        <div className={`graph-legend-series ${seriesOptionClasses}`}>
          {seriesLabel}
          {valueItems}
        </div>
      );
    }
  }
}

interface LegendSeriesLabelProps {
  label: string;
  color: string;
  yaxis?: number;
  onLabelClick?: (event: any) => void;
}

class LegendSeriesLabel extends PureComponent<LegendSeriesLabelProps & LegendSeriesIconProps> {
  static defaultProps: Partial<LegendSeriesLabelProps> = {
    yaxis: undefined,
    onLabelClick: () => {},
  };

  render() {
    const { label, color, yaxis } = this.props;
    const { onColorChange, onToggleAxis } = this.props;
    return [
      <LegendSeriesIcon
        key="icon"
        color={color}
        yaxis={yaxis}
        onColorChange={onColorChange}
        onToggleAxis={onToggleAxis}
      />,
      <a
        className="graph-legend-alias pointer"
        title={label}
        key="label"
        onClick={e => this.props.onLabelClick(e)}
        aria-label={selectors.components.Panels.Visualization.Graph.Legend.legendItemAlias(label)}
      >
        {label}
      </a>,
    ];
  }
}

interface LegendSeriesIconProps {
  color: string;
  yaxis?: number;
  onColorChange?: (color: string) => void;
  onToggleAxis?: () => void;
}

interface LegendSeriesIconState {
  color: string;
}

function SeriesIcon({ color }: { color: string }) {
  return <Icon name="minus" style={{ color }} />;
}

class LegendSeriesIcon extends PureComponent<LegendSeriesIconProps, LegendSeriesIconState> {
  static defaultProps: Partial<LegendSeriesIconProps> = {
    yaxis: undefined,
    onColorChange: () => {},
    onToggleAxis: () => {},
  };

  render() {
    return (
      <SeriesColorPicker
        yaxis={this.props.yaxis}
        color={this.props.color}
        onChange={this.props.onColorChange}
        onToggleAxis={this.props.onToggleAxis}
        enableNamedColors
      >
        {({ ref, showColorPicker, hideColorPicker }) => (
          <span ref={ref} onClick={showColorPicker} onMouseLeave={hideColorPicker} className="graph-legend-icon">
            <SeriesIcon color={this.props.color} />
          </span>
        )}
      </SeriesColorPicker>
    );
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
