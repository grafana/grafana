import React from 'react';
import { TimeSeries } from 'app/core/core';
import withColorPicker from 'app/core/components/colorpicker/withColorPicker';

export const LEGEND_STATS = ['min', 'max', 'avg', 'current', 'total'];

export interface LegendLabelProps {
  series: TimeSeries;
  asTable?: boolean;
  hidden?: boolean;
  onLabelClick?: (series, event) => void;
  onColorChange?: (series, color: string) => void;
  onToggleAxis?: (series) => void;
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

export class LegendItem extends React.PureComponent<LegendItemProps> {
  static defaultProps = {
    asTable: false,
    hidden: false,
    onLabelClick: () => {},
    onColorChange: () => {},
    onToggleAxis: () => {},
  };

  onLabelClick = e => this.props.onLabelClick(this.props.series, e);
  onToggleAxis = () => {
    this.props.onToggleAxis(this.props.series);
    this.forceUpdate();
  };
  onColorChange = color => {
    this.props.onColorChange(this.props.series, color);
    // this.forceUpdate();
  };

  render() {
    const { series, hidden, asTable } = this.props;
    const { aliasEscaped, color, yaxis } = this.props.series;
    const seriesOptionClasses = getOptionSeriesCSSClasses(series, hidden);
    const valueItems = this.props.values ? renderLegendValues(this.props, series, asTable) : [];
    const seriesLabel = (
      <LegendSeriesLabel
        label={aliasEscaped}
        color={color}
        yaxis={yaxis}
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
  onLabelClick?: (event) => void;
}

class LegendSeriesLabel extends React.PureComponent<LegendSeriesLabelProps & LegendSeriesIconProps> {
  static defaultProps = {
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
      <a className="graph-legend-alias pointer" title={label} key="label" onClick={e => this.props.onLabelClick(e)}>
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

function SeriesIcon(props) {
  return <i className="fa fa-minus pointer" style={{ color: props.color }} />;
}

class LegendSeriesIcon extends React.PureComponent<LegendSeriesIconProps> {
  static defaultProps = {
    yaxis: undefined,
    onColorChange: () => {},
    onToggleAxis: () => {},
  };

  render() {
    const { color, yaxis } = this.props;
    const IconWithColorPicker = withColorPicker(SeriesIcon);

    return (
      <IconWithColorPicker
        optionalClass="graph-legend-icon"
        color={color}
        yaxis={yaxis}
        onColorChange={this.props.onColorChange}
        onToggleAxis={this.props.onToggleAxis}
      />
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

function renderLegendValues(props: LegendItemProps, series, asTable = false) {
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

function getOptionSeriesCSSClasses(series, hidden) {
  const classes = [];
  if (series.yaxis === 2) {
    classes.push('graph-legend-series--right-y');
  }
  if (hidden) {
    classes.push('graph-legend-series-hidden');
  }
  return classes.join(' ');
}
