//// Libraries
import React, { PureComponent } from 'react';
// Types
import { PanelEditorProps } from '@grafana/data';
import { Switch } from '@grafana/ui';
import { Options } from './types';

export class TablePanelEditor extends PureComponent<PanelEditorProps<Options>> {
  onToggleShowHeader = () => {
    this.props.onOptionsChange({ ...this.props.options, showHeader: !this.props.options.showHeader });
  };

  onToggleResizable = () => {
    this.props.onOptionsChange({ ...this.props.options, resizable: !this.props.options.resizable });
  };

  render() {
    const { showHeader, resizable } = this.props.options;

    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="section-heading">Header</h5>
          <Switch label="Show" labelClass="width-6" checked={showHeader} onChange={this.onToggleShowHeader} />
        </div>
        <div className="section gf-form-group">
          <h5 className="section-heading">Columns</h5>
          <Switch label="Resizable" labelClass="width-6" checked={resizable} onChange={this.onToggleResizable} />
        </div>
      </div>
    );
  }
}
