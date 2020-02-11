import React, { PureComponent } from 'react';
import { VariableState } from '../state/types';
import { VariableHide } from '../variable';
import { e2e } from '@grafana/e2e';
import { variableAdapters } from '../adapters';

export class VariablePicker extends PureComponent<VariableState> {
  render() {
    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

    const { hide, label, name } = this.props.variable;
    const labelOrName = label || name;
    const PickerToRender = variableAdapters.get(this.props.variable.type).picker;

    return (
      <div className="gf-form">
        {hide === VariableHide.dontHide && (
          <label
            className="gf-form-label template-variable"
            aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemLabels(labelOrName)}
          >
            {labelOrName}
          </label>
        )}
        {hide !== VariableHide.hideVariable && PickerToRender && (
          <PickerToRender variable={this.props.variable} picker={this.props.picker} />
        )}
      </div>
    );
  }
}
