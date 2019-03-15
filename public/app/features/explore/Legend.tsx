import React, { MouseEvent, PureComponent } from 'react';
import classNames from 'classnames';
import { TimeSeries } from 'app/core/core';

interface LegendProps {
  data: TimeSeries[];
  hiddenSeries: Set<string>;
  onHighlightSeries?: (series: TimeSeries) => void;
  onUnhighlightSeries?: (series: TimeSeries) => void;
  onToggleSeries?: (series: TimeSeries, exclusive: boolean) => void;
}

interface LegendItemProps {
  hidden: boolean;
  onClickLabel?: (series: TimeSeries, event: MouseEvent) => void;
  onHighlightSeries?: (series: TimeSeries) => void;
  onUnhighlightSeries?: (series: TimeSeries) => void;
  series: TimeSeries;
}

class LegendItem extends PureComponent<LegendItemProps> {
  onClickLabel = e => this.props.onClickLabel(this.props.series, e);

  onHighlight = (e: MouseEvent) => {
    const { hidden, series, onHighlightSeries } = this.props;
    if (!hidden) {
      onHighlightSeries(series);
    }
  };

  onUnhighlight = (e: MouseEvent) => {
    const { hidden, series, onUnhighlightSeries } = this.props;
    if (!hidden) {
      onUnhighlightSeries(series);
    }
  };

  render() {
    const { hidden, series } = this.props;
    const seriesClasses = classNames({
      'graph-legend-series-hidden': hidden,
    });
    return (
      <div
        className={`graph-legend-series ${seriesClasses}`}
        onMouseOver={this.onHighlight}
        onMouseOut={this.onUnhighlight}
      >
        <div className="graph-legend-icon">
          <i className="fa fa-minus pointer" style={{ color: series.color }} />
        </div>
        <a className="graph-legend-alias pointer" title={series.alias} onClick={this.onClickLabel}>
          {series.alias}
        </a>
      </div>
    );
  }
}

export default class Legend extends PureComponent<LegendProps> {
  static defaultProps = {
    onHighlightSeries: () => {},
    onUnhighlightSeries: () => {},
    onToggleSeries: () => {},
  };

  onClickLabel = (series: TimeSeries, event: MouseEvent) => {
    const { onToggleSeries } = this.props;
    const exclusive = event.ctrlKey || event.metaKey || event.shiftKey;
    onToggleSeries(series, !exclusive);
  };

  render() {
    const { data, hiddenSeries, onHighlightSeries, onUnhighlightSeries } = this.props;
    const items = data || [];
    return (
      <div className="graph-legend ps">
        {items.map((series, i) => (
          <LegendItem
            hidden={hiddenSeries.has(series.alias)}
            // Workaround to resolve conflicts since series visibility tracks the alias property
            key={`${series.id}-${i}`}
            onClickLabel={this.onClickLabel}
            onHighlightSeries={onHighlightSeries}
            onUnhighlightSeries={onUnhighlightSeries}
            series={series}
          />
        ))}
      </div>
    );
  }
}
