import React, { FunctionComponent } from 'react';
import { Switch } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import { QueryVariableModel } from '../variable';

export const SelectionOptionsEditor: FunctionComponent<{ variable: QueryVariableModel }> = props => {
  return (
    <div className="section gf-form-group">
      <h5 className="section-heading">Selection Options</h5>
      <div className="section">
        <Switch
          label="Multi-value"
          labelClass="width-10"
          checked={props.variable.multi}
          onChange={() => {}}
          tooltip={'Enables multiple values to be selected at the same time'}
          aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.selectionOptionsMultiSwitch}
        />
        <Switch
          label="Include All option"
          labelClass="width-10"
          checked={props.variable.includeAll}
          onChange={() => {}}
          tooltip={'Enables multiple values to be selected at the same time'}
          aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.selectionOptionsIncludeAllSwitch}
        />
      </div>
      {props.variable.includeAll && (
        <div className="gf-form">
          <span className="gf-form-label width-10">Custom all value</span>
          <input
            type="text"
            className="gf-form-input max-width-15"
            value={props.variable.allValue}
            onChange={() => {}}
            placeholder="blank = auto"
            aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.selectionOptionsCustomAllInput}
          />
        </div>
      )}
    </div>
  );
};
SelectionOptionsEditor.displayName = 'SelectionOptionsEditor';
