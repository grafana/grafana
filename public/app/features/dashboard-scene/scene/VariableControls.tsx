import { css, cx } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { VariableHide } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import {
  ControlsLabel,
  type ControlsLayout,
  sceneGraph,
  sceneUtils,
  type SceneVariable,
  type SceneVariables,
  SceneVariableSet,
  type SceneVariableState,
  useSceneObjectState,
} from '@grafana/scenes';
import { useElementSelection } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { dashboardEditActions } from '../edit-pane/shared';
import { filterSectionRepeatLocalVariables } from '../variables/utils';

import { ControlActionsPopover, ControlEditActions } from './ControlActionsPopover';
import { DashboardScene } from './DashboardScene';
import { AddVariableButton } from './VariableControlsAddButton';
import { VariableDescriptionTooltip } from './VariableDescriptionTooltip';

export function VariableControls({ dashboard }: { dashboard: DashboardScene }) {
  const { variables } = sceneGraph.getVariables(dashboard)!.useState();
  const { isEditing } = dashboard.useState();
  const isEditingNewLayouts = isEditing && config.featureToggles.dashboardNewLayouts;

  const visibleVariables = variables.filter(
    (v: SceneVariable) =>
      v.state.hide !== VariableHide.inControlsMenu &&
      (v.state.hide !== VariableHide.hideVariable || v.UNSAFE_renderAsHidden)
  );

  return (
    <>
      {visibleVariables.length > 0 &&
        visibleVariables.map((variable) => (
          <VariableValueSelectWrapper
            key={variable.state.key}
            variable={variable}
            isEditingNewLayouts={isEditingNewLayouts}
          />
        ))}
      {config.featureToggles.dashboardNewLayouts ? <AddVariableButton dashboard={dashboard} /> : null}
    </>
  );
}

interface VariableSelectProps {
  variable: SceneVariable;
  inMenu?: boolean;
  isEditingNewLayouts?: boolean;
}

export function VariableValueSelectWrapper({ variable, inMenu, isEditingNewLayouts }: VariableSelectProps) {
  const styles = useStyles2(getStyles);
  const state = useSceneObjectState<SceneVariableState>(variable, { shouldActivateOrKeepAlive: true });
  const { isSelected, isSelectable } = useElementSelection(variable.state.key);
  const isHidden = state.hide === VariableHide.hideVariable;

  const onClickEditVariable = useCallback(() => {
    const dashboard = sceneGraph.getAncestor(variable, DashboardScene);
    dashboard.state.editPane.selectObject(variable);
  }, [variable]);

  const onClickDeleteVariable = useCallback(() => {
    const set = variable.parent;
    if (set instanceof SceneVariableSet) {
      dashboardEditActions.removeVariable({ source: set, removedObject: variable });
    }
  }, [variable]);

  const editActions = useMemo(
    () => (
      <ControlEditActions element={variable} onClickEdit={onClickEditVariable} onClickDelete={onClickDeleteVariable} />
    ),
    [variable, onClickDeleteVariable, onClickEditVariable]
  );

  // UNSAFE_renderAsHidden variables (like ScopesVariable) should always render invisibly
  if (isHidden && variable.UNSAFE_renderAsHidden) {
    return <variable.Component model={variable} />;
  }

  if (isHidden && !isEditingNewLayouts) {
    return null;
  }

  // For switch variables in menu, we want to show the switch on the left and the label on the right
  if (inMenu && sceneUtils.isSwitchVariable(variable)) {
    return (
      <ControlActionsPopover isEditable={Boolean(isSelectable)} content={editActions}>
        <div
          className={cx(
            styles.switchMenuContainer,
            isSelected && 'dashboard-selected-element',
            isSelectable && !isSelected && 'dashboard-selectable-element'
          )}
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
        >
          <div className={styles.switchControl}>
            <variable.Component model={variable} />
          </div>
          <VariableLabel
            variable={variable}
            layout={'vertical'}
            className={cx(isSelectable && styles.labelSelectable, styles.switchLabel)}
          />
        </div>
      </ControlActionsPopover>
    );
  }

  if (inMenu) {
    return (
      <ControlActionsPopover isEditable={Boolean(isSelectable)} content={editActions}>
        <div
          className={cx(
            styles.verticalContainer,
            isSelected && 'dashboard-selected-element',
            isSelectable && !isSelected && 'dashboard-selectable-element'
          )}
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
        >
          <VariableLabel
            variable={variable}
            layout={'vertical'}
            className={cx(isSelectable && styles.labelSelectable)}
          />
          <variable.Component model={variable} />
        </div>
      </ControlActionsPopover>
    );
  }

  return (
    <ControlActionsPopover isEditable={Boolean(isSelectable)} content={editActions}>
      <div
        className={cx(
          styles.container,
          isSelected && 'dashboard-selected-element',
          isSelectable && !isSelected && 'dashboard-selectable-element'
        )}
        data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
      >
        <VariableLabel variable={variable} className={cx(isSelectable && styles.labelSelectable, styles.label)} />
        <variable.Component model={variable} />
      </div>
    </ControlActionsPopover>
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
  const elementId = sceneUtils.getVariableControlId(state.type, state.key);

  if (variable.state.hide === VariableHide.hideLabel) {
    return null;
  }

  const labelOrName = state.label || state.name;
  const controlsLayout = layout ?? 'horizontal';
  const descriptionSuffix =
    state.description != null && state.description !== '' ? (
      <VariableDescriptionTooltip
        description={state.description}
        placement={controlsLayout === 'vertical' ? 'top' : 'bottom'}
      />
    ) : undefined;

  return (
    <ControlsLabel
      htmlFor={elementId}
      isLoading={state.loading}
      onCancel={() => variable.onCancel?.()}
      label={labelOrName}
      error={state.error}
      layout={controlsLayout}
      description={undefined}
      suffix={descriptionSuffix}
      className={className}
    />
  );
}

export function SectionVariableControls({ variableSet }: { variableSet: SceneVariables }) {
  const { variables } = variableSet.useState();
  const styles = useStyles2(getSectionVariableStyles);

  const visibleVariables = filterSectionRepeatLocalVariables(variables, variableSet).filter(
    (v) => v.state.hide !== VariableHide.hideVariable
  );

  if (visibleVariables.length === 0) {
    return null;
  }

  return (
    // Prevent row selection on click (see RowItemRenderer onPointerUp)
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={styles.sectionVariables}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {visibleVariables.map((variable) => (
        <VariableValueSelectWrapper key={variable.state.key} variable={variable} />
      ))}
    </div>
  );
}

const getSectionVariableStyles = (theme: GrafanaTheme2) => ({
  sectionVariables: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  }),
});

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    // No border for second element (inputs) as label and input border is shared
    '> :nth-child(2)': css({
      borderTopLeftRadius: 'unset',
      borderBottomLeftRadius: 'unset',
    }),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
  verticalContainer: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
  }),
  switchMenuContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
  }),
  switchControl: css({
    '& > div': {
      border: 'none',
      background: 'transparent',
      paddingRight: theme.spacing(0.5),
      height: theme.spacing(2),
    },
  }),
  switchLabel: css({
    marginTop: 0,
    marginBottom: 0,
  }),
  labelSelectable: css({
    cursor: 'pointer',
  }),
  label: css({
    display: 'flex',
    alignItems: 'center',
  }),
});
