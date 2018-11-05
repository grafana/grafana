import _ from 'lodash';
import React, { PureComponent } from 'react';

import Graph from 'app/viz/Graph';
import { Switch } from 'app/core/components/Switch/Switch';

import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import { PanelProps, NullValueMode } from 'app/types';

interface Options {
  showBars: boolean;
  showLines: boolean;
  showPoints: boolean;

  onChange: (options: Options) => void;
}

interface Props extends PanelProps<Options> {}

export class Graph2 extends PureComponent<Props> {
  constructor(props) {
    super(props);
  }

  render() {
    const { timeSeries, timeRange } = this.props;
    const { showLines, showBars, showPoints } = this.props.options;

    const vmSeries = getTimeSeriesVMs({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
    });

    return (
      <Graph
        timeSeries={vmSeries}
        timeRange={timeRange}
        showLines={showLines}
        showPoints={showPoints}
        showBars={showBars}
      />
    );
  }
}

export class GraphOptions extends PureComponent<Options> {
  onToggleLines = () => {
    const options = this.props as Options;

    this.props.onChange({
      ...options,
      showLines: !this.props.showLines,
    });
  };

  onTogglePoints = () => {
    const options = this.props as Options;

    this.props.onChange({
      ...options,
      showPoints: !this.props.showPoints,
    });
  };

  render() {
    const { showBars, showPoints, showLines } = this.props;

    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="page-heading">Draw Modes</h5>
          <Switch label="Lines" labelClass="width-5" checked={showLines} onChange={this.onToggleLines} />
          <Switch label="Bars" labelClass="width-5" checked={showBars} onChange={this.onToggleLines} />
          <Switch label="Points" labelClass="width-5" checked={showPoints} onChange={this.onTogglePoints} />
        </div>
      </div>
    );
  }
}

export { Graph2 as PanelComponent, GraphOptions as PanelOptionsComponent };
