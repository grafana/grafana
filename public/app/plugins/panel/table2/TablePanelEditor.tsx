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

  onRowsPerPageChange = ({ target }) => this.props.onOptionsChange({ ...this.props.options, pageSize: target.value });

  render() {
    const { showHeader, pageSize } = this.props.options;

    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="section-heading">Header</h5>
          <Switch label="Show" labelClass="width-5" checked={showHeader} onChange={this.onToggleShowHeader} />
        </div>

        <div className="section gf-form-group">
          <h5 className="section-heading">Paging</h5>
          <FormField label="Rows per page" labelWidth={8} onChange={this.onRowsPerPageChange} value={pageSize} />
        </div>
      </div>
    );
  }
}
