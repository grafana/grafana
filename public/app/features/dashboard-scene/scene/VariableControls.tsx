import { css } from '@emotion/css';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { sceneGraph, useSceneObjectState, SceneVariable, SceneVariableState, ControlsLabel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';

export function VariableControls({ dashboard }: { dashboard: DashboardScene }) {
  const variables = sceneGraph.getVariables(dashboard)!.useState();

  return (
    <>
      {variables.variables.map((variable) => (
        <VariableValueSelectWrapper key={variable.state.key} variable={variable} />
      ))}
    </>
  );
}

interface VariableSelectProps {
  variable: SceneVariable;
}

export function VariableValueSelectWrapper({ variable }: VariableSelectProps) {
  const state = useSceneObjectState<SceneVariableState>(variable, { shouldActivateOrKeepAlive: true });

  if (state.hide === VariableHide.hideVariable) {
    return null;
  }

  return (
    <div className={containerStyle} data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}>
      <VariableLabel variable={variable} />
      <variable.Component model={variable} />
    </div>
  );
}

function VariableLabel({ variable }: VariableSelectProps) {
  const { state } = variable;

  if (variable.state.hide === VariableHide.hideLabel) {
    return null;
  }

  const labelOrName = state.label || state.name;
  const elementId = `var-${state.key}`;

  return (
    <ControlsLabel
      htmlFor={elementId}
      isLoading={state.loading}
      onCancel={() => variable.onCancel?.()}
      label={labelOrName}
      error={state.error}
      layout={'horizontal'}
      description={state.description ?? undefined}
    />
  );
}

const containerStyle = css({
  display: 'flex',
  // No border for second element (inputs) as label and input border is shared
  '> :nth-child(2)': css({
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  }),
});
