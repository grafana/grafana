import React, { PureComponent } from 'react';
import { VariableHide, VariableModel } from '../variable';
import { e2e } from '@grafana/e2e';
import { variableAdapters } from '../adapters';

interface Props {
  variable: VariableModel;
}

export class PickerRenderer extends PureComponent<Props> {
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
        {hide !== VariableHide.hideVariable && PickerToRender && <PickerToRender variable={this.props.variable} />}
      </div>
    );
  }
}
