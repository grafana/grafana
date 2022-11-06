import React from 'react';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip } from '@grafana/ui';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneComponentProps, SceneObject, SceneObjectStatePlain } from '../../core/types';
import { SceneVariableState } from '../types';

export class VariableValueSelectors extends SceneObjectBase<SceneObjectStatePlain> {
  public static Component = VariableValueSelectorsRenderer;
}

function VariableValueSelectorsRenderer({ model }: SceneComponentProps<VariableValueSelectors>) {
  const variables = model.getVariables()!.useState();

  return (
    <>
      {variables.variables.map((variable) => (
        <VariableValueSelectWrapper key={variable.state.key} variable={variable} />
      ))}
    </>
  );
}

function VariableValueSelectWrapper({ variable }: { variable: SceneObject<SceneVariableState> }) {
  const state = variable.useState();

  if (state.hide === VariableHide.hideVariable) {
    return null;
  }

  return (
    <div className="gf-form">
      <VariableLabel state={state} />
      <variable.Component model={variable} />
    </div>
  );
}

function VariableLabel({ state }: { state: SceneVariableState }) {
  if (state.hide === VariableHide.hideLabel) {
    return null;
  }

  const elementId = `var-${state.key}`;
  const labelOrName = state.label ?? state.name;

  if (state.description) {
    return (
      <Tooltip content={state.description} placement={'bottom'}>
        <label
          className="gf-form-label gf-form-label--variable"
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
          htmlFor={elementId}
        >
          {labelOrName}
        </label>
      </Tooltip>
    );
  }

  return (
    <label
      className="gf-form-label gf-form-label--variable"
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItemLabels(labelOrName)}
      htmlFor={elementId}
    >
      {labelOrName}
    </label>
  );
}
