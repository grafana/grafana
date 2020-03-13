import React, { PureComponent } from 'react';
import { AdHocVariableModel } from '../../templating/variable';
import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<AdHocVariableModel> {}

export class AdHocVariableEditor extends PureComponent<Props> {
  render() {
    return (
      <div className="gf-form-group">
        <h5 className="section-heading">Options</h5>
        <div className="gf-form max-width-21">
          <span className="gf-form-label width-8">Data source</span>
          <div className="gf-form-select-wrapper max-width-14">
            <select
              className="gf-form-input"
              ng-model="current.datasource"
              ng-options="f.value as f.name for f in datasources"
              required
              ng-change="validate()"
              aria-label="Variable editor Form AdHoc DataSource select"
            >
              <option value="" ng-if="false"></option>
            </select>
          </div>
        </div>
      </div>
    );
  }
}
