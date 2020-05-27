import React, { FunctionComponent, useMemo } from 'react';
import { VariableHide, VariableModel } from '../../templating/types';
import { selectors } from '@grafana/e2e-selectors';
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
          className="gf-form-label gf-form-label--variable"
          aria-label={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
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
