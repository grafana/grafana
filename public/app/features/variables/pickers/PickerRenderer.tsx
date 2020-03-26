import React, { FunctionComponent, useMemo } from 'react';
import { VariableHide, VariableModel } from '../../templating/types';
import { e2e } from '@grafana/e2e';
import { variableAdapters } from '../adapters';

interface Props {
  variable: VariableModel;
}

export const PickerRenderer: FunctionComponent<Props> = props => {
  const PickerToRender = useMemo(() => variableAdapters.get(props.variable.type).picker, [props.variable]);
  const labelOrName = useMemo(() => props.variable.label || props.variable.name, [props.variable]);

  if (!props.variable) {
    return <div>Couldn't load variable</div>;
  }

  return (
    <div className="gf-form">
      {props.variable.hide === VariableHide.dontHide && (
        <label
          className="gf-form-label template-variable"
          aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemLabels(labelOrName)}
        >
          {labelOrName}
        </label>
      )}
      {props.variable.hide !== VariableHide.hideVariable && PickerToRender && (
        <PickerToRender variable={props.variable} />
      )}
    </div>
  );
};
