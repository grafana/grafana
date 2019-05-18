//// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { PanelEditorProps, Switch, LegendOptions } from '@grafana/ui';
import { Options, GraphOptions } from './types';
import { GraphLegendEditor } from './GraphLegendEditor';

export class GraphPanelEditor extends PureComponent<PanelEditorProps<Options>> {
  onGraphOptionsChange = (options: Partial<GraphOptions>) => {
    this.props.onOptionsChange({
      ...this.props.options,
      graph: {
        ...this.props.options.graph,
        ...options,
      },
    });
  };

  onLegendOptionsChange = (options: LegendOptions) => {
    this.props.onOptionsChange({ ...this.props.options, legend: options });
  };

  onToggleLines = () => {
    this.onGraphOptionsChange({ showLines: !this.props.options.graph.showLines });
  };

  onToggleBars = () => {
    this.onGraphOptionsChange({ showBars: !this.props.options.graph.showBars });
  };

  onTogglePoints = () => {
    this.onGraphOptionsChange({ showPoints: !this.props.options.graph.showPoints });
  };

  render() {
    const {
      graph: { showBars, showPoints, showLines },
    } = this.props.options;

    return (
      <>
        <div className="section gf-form-group">
          <h5 className="section-heading">Draw Modes</h5>
          <Switch label="Lines" labelClass="width-5" checked={showLines} onChange={this.onToggleLines} />
          <Switch label="Bars" labelClass="width-5" checked={showBars} onChange={this.onToggleBars} />
          <Switch label="Points" labelClass="width-5" checked={showPoints} onChange={this.onTogglePoints} />
        </div>
        <GraphLegendEditor options={this.props.options.legend} onChange={this.onLegendOptionsChange} />
      </>
    );
  }
}
