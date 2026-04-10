import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo } from 'react';

import { type GrafanaTheme2, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, reportInteraction } from '@grafana/runtime';
import {
  ControlsLabel,
  type ControlsLayout,
  sceneGraph,
  sceneUtils,
  type SceneVariable,
  type SceneVariables,
  SceneVariableSet,
  type SceneVariableState,
  SceneVariableValueChangedEvent,
  useSceneObjectState,
} from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

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

  // Subscribe to variable value changes to track interactions
  useEffect(() => {
    const subscription = dashboard.subscribeToEvent(SceneVariableValueChangedEvent, () => {
      reportInteraction('grafana_dashboards_variable_changed');
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dashboard]);

  const visibleVariables = variables.filter(
    (v: SceneVariable) =>
      v.state.hide !== VariableHide.inControlsMenu &&
      (v.state.hide !== VariableHide.hideVariable || v.UNSAFE_renderAsHidden)
  );

  const adHocVar = visibleVariables.find((v) => sceneUtils.isAdHocVariable(v));
  const groupByVar = visibleVariables.find((v) => sceneUtils.isGroupByVariable(v));

  const restVariables = visibleVariables.filter(
    (v) => v.state.name !== adHocVar?.state.name && v.state.name !== groupByVar?.state.name
  );

  const hasDrilldownControls = config.featureToggles.dashboardAdHocAndGroupByWrapper && adHocVar && groupByVar;
  const variablesToRender = hasDrilldownControls ? restVariables : visibleVariables;

  return (
    <>
      {variablesToRender.length > 0 &&
        variablesToRender.map((variable) => (
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
    dashboard.state.editPane.selectObject(variable, variable.state.key!);
  }, [variable]);

  const onClickDeleteVariable = useCallback(() => {
    const set = variable.parent;
    if (set instanceof SceneVariableSet) {
      dashboardEditActions.removeVariable({ source: set, removedObject: variable });
    }
  }, [variable]);

  const editActions = useMemo(
    () => <ControlEditActions onClickEdit={onClickEditVariable} onClickDelete={onClickDeleteVariable} />,
    [onClickDeleteVariable, onClickEditVariable]
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
  const elementId = `var-${state.key}`;

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
