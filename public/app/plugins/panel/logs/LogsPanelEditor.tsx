//// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { PanelEditorProps /*, Switch,*/ } from '@grafana/ui';
import { Options } from './types';

export class LogsPanelEditor extends PureComponent<PanelEditorProps<Options>> {
  render() {
    // const {
    //   graph: { showBars, showPoints, showLines },
    // } = this.props.options;

    return (
      <>
        <div className="section gf-form-group">Tada</div>
        {/* <div className="section gf-form-group">
          <h5 className="section-heading">Draw Modes</h5>
          <Switch label="Lines" labelClass="width-5" checked={showLines} onChange={this.onToggleLines} />
          <Switch label="Bars" labelClass="width-5" checked={showBars} onChange={this.onToggleBars} />
          <Switch label="Points" labelClass="width-5" checked={showPoints} onChange={this.onTogglePoints} />
        </div>
        <GraphLegendEditor options={this.props.options.legend} onChange={this.onLegendOptionsChange} /> */}
      </>
    );
  }
}
