//// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { PanelEditorProps, Switch, FormField } from '@grafana/ui';
import { Options } from './types';

export class TablePanelEditor extends PureComponent<PanelEditorProps<Options>> {
  onToggleShowHeader = () => {
    this.props.onOptionsChange({ ...this.props.options, showHeader: !this.props.options.showHeader });
  };

  onToggleFixedHeader = () => {
    this.props.onOptionsChange({ ...this.props.options, fixedHeader: !this.props.options.fixedHeader });
  };

  onToggleRotate = () => {
    this.props.onOptionsChange({ ...this.props.options, rotate: !this.props.options.rotate });
  };

  onFixedColumnsChange = ({ target }: any) => {
    this.props.onOptionsChange({ ...this.props.options, fixedColumns: target.value });
  };

  render() {
    const { showHeader, fixedHeader, rotate, fixedColumns } = this.props.options;

    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="section-heading">Header</h5>
          <Switch label="Show" labelClass="width-6" checked={showHeader} onChange={this.onToggleShowHeader} />
          <Switch label="Fixed" labelClass="width-6" checked={fixedHeader} onChange={this.onToggleFixedHeader} />
        </div>

        <div className="section gf-form-group">
          <h5 className="section-heading">Display</h5>
          <Switch label="Rotate" labelClass="width-8" checked={rotate} onChange={this.onToggleRotate} />
          <FormField
            label="Fixed Columns"
            labelWidth={8}
            inputWidth={4}
            type="number"
            step="1"
            min="0"
            max="100"
            onChange={this.onFixedColumnsChange}
            value={fixedColumns}
          />
        </div>
      </div>
    );
  }
}
