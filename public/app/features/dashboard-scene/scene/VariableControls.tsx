import { css, cx } from '@emotion/css';

import { VariableHide, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  sceneGraph,
  useSceneObjectState,
  SceneVariable,
  SceneVariableState,
  ControlsLabel,
  ControlsLayout,
} from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';

export function VariableControls({ dashboard }: { dashboard: DashboardScene }) {
  const { variables } = sceneGraph.getVariables(dashboard)!.useState();

  return (
    <>
      {variables
        .filter((v) => !v.state.showInControlsMenu)
        .map((variable) => (
          <VariableValueSelectWrapper key={variable.state.key} variable={variable} />
        ))}
    </>
  );
}

interface VariableSelectProps {
  variable: SceneVariable;
  inMenu?: boolean;
}

export function VariableValueSelectWrapper({ variable, inMenu }: VariableSelectProps) {
  const state = useSceneObjectState<SceneVariableState>(variable, { shouldActivateOrKeepAlive: true });
  const { isSelected, onSelect, isSelectable } = useElementSelection(variable.state.key);
  const styles = useStyles2(getStyles);

  if (state.hide === VariableHide.hideVariable) {
    if (variable.UNSAFE_renderAsHidden) {
      return <variable.Component model={variable} />;
    }

    return null;
  }

  const onPointerDown = (evt: React.PointerEvent) => {
    if (!isSelectable) {
      return;
    }

    // Ignore click if it's inside the value control
    if (evt.target instanceof Element && !evt.target.closest(`label`)) {
      // Prevent clearing selection when clicking inside value
      evt.stopPropagation();
      return;
    }

    if (isSelectable && onSelect) {
      evt.stopPropagation();
      onSelect(evt);
    }
  };

  if (inMenu) {
    return (
      <div className={styles.verticalContainer} data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}>
        <VariableLabel variable={variable} layout={'vertical'} />
        <variable.Component model={variable} />
      </div>
    );
  }

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

function VariableLabel({
  variable,
  className,
  layout,
}: {
  variable: SceneVariable;
  className?: string;
  layout?: ControlsLayout;
}) {
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
      layout={layout ?? 'horizontal'}
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
      borderTopLeftRadius: 'unset',
      borderBottomLeftRadius: 'unset',
    }),
  }),
  verticalContainer: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  labelWrapper: css({
    display: 'flex',
    alignItems: 'center',
  }),
  labelSelectable: css({
    cursor: 'pointer',
  }),
});
