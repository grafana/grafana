//// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { PanelEditorProps } from '@grafana/data';
import { Switch } from '@grafana/ui';
import { Options } from './types';

export class TablePanelEditor extends PureComponent<PanelEditorProps<Options>> {
  onToggleShowHeader = () => {
    this.props.onOptionsChange({ ...this.props.options, showHeader: !this.props.options.showHeader });
  };

  render() {
    const { showHeader } = this.props.options;

    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="section-heading">Header</h5>
          <Switch label="Show" labelClass="width-6" checked={showHeader} onChange={this.onToggleShowHeader} />
        </div>
      </div>
    );
  }
}
