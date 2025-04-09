import { css, cx } from '@emotion/css';

import { VariableHide, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { sceneGraph, useSceneObjectState, SceneVariable, SceneVariableState, ControlsLabel } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

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
  const { isSelected, onSelect, isSelectable } = useElementSelection(variable.state.key);
  const styles = useStyles2(getStyles);

  if (state.hide === VariableHide.hideVariable) {
    return null;
  }

  const onPointerDown = (evt: React.PointerEvent) => {
    if (isSelectable && onSelect) {
      evt.stopPropagation();
      onSelect(evt);
    }
  };

  return (
    <div
      className={cx(
        styles.container,
        isSelected && 'dashboard-selected-element',
        isSelectable && !isSelected && 'dashboard-selectable-element'
      )}
      onPointerDown={onPointerDown}
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
    >
      <VariableLabel variable={variable} className={cx(isSelectable && styles.labelSelectable)} />
      <variable.Component model={variable} />
    </div>
  );
}

function VariableLabel({ variable, className }: { variable: SceneVariable; className?: string }) {
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
      className={className}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    // No border for second element (inputs) as label and input border is shared
    '> :nth-child(2)': css({
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    }),
  }),
  labelWrapper: css({
    display: 'flex',
    alignItems: 'center',
  }),
  labelSelectable: css({
    cursor: 'pointer',
  }),
});
