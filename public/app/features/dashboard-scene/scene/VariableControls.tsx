import { css, cx } from '@emotion/css';
import { autoUpdate, offset, safePolygon, useFloating, useHover, useInteractions } from '@floating-ui/react';
import { cloneElement, useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import {
  ControlsLabel,
  ControlsLayout,
  sceneGraph,
  sceneUtils,
  SceneVariable,
  SceneVariableSet,
  SceneVariableState,
  SceneVariableValueChangedEvent,
  useSceneObjectState,
} from '@grafana/scenes';
import { IconButton, Portal, useElementSelection, useStyles2 } from '@grafana/ui';

import { dashboardEditActions } from '../edit-pane/shared';

import { DashboardScene } from './DashboardScene';
import { AddVariableButton } from './VariableControlsAddButton';

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
      {config.featureToggles.dashboardNewLayouts ? <AddVariableButton dashboard={dashboard} /> : null}

      {variablesToRender.length > 0 &&
        variablesToRender.map((variable) => (
          <VariableValueSelectWrapper
            key={variable.state.key}
            variable={variable}
            isEditingNewLayouts={isEditingNewLayouts}
          />
        ))}
    </>
  );
}

interface VariableSelectProps {
  variable: SceneVariable;
  inMenu?: boolean;
  isEditingNewLayouts?: boolean;
}

export function VariableValueSelectWrapper({ variable, inMenu, isEditingNewLayouts }: VariableSelectProps) {
  const state = useSceneObjectState<SceneVariableState>(variable, { shouldActivateOrKeepAlive: true });
  const { isSelected, isSelectable } = useElementSelection(variable.state.key);
  const isHidden = state.hide === VariableHide.hideVariable;
  const styles = useStyles2(getStyles);

  // UNSAFE_renderAsHidden variables (like ScopesVariable) should always render invisibly
  if (isHidden && variable.UNSAFE_renderAsHidden) {
    return <variable.Component model={variable} />;
  }

  if (isHidden && !isEditingNewLayouts) {
    return null;
  }

  const editActions = isSelectable ? <EditActions variable={variable} /> : null;

  // For switch variables in menu, we want to show the switch on the left and the label on the right
  if (inMenu && sceneUtils.isSwitchVariable(variable)) {
    return (
      <ActionsPopover content={editActions}>
        <div
          className={cx(styles.switchMenuContainer, isSelected && 'dashboard-selected-element')}
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
      </ActionsPopover>
    );
  }

  if (inMenu) {
    return (
      <ActionsPopover content={editActions}>
        <div
          className={cx(styles.verticalContainer, isSelected && 'dashboard-selected-element')}
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
        >
          <VariableLabel
            variable={variable}
            layout={'vertical'}
            className={cx(isSelectable && styles.labelSelectable)}
          />
          <variable.Component model={variable} />
        </div>
      </ActionsPopover>
    );
  }

  return (
    <ActionsPopover content={editActions}>
      <div
        className={cx(styles.container, isSelected && 'dashboard-selected-element')}
        data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
      >
        <VariableLabel variable={variable} className={cx(isSelectable && styles.labelSelectable, styles.label)} />
        <variable.Component model={variable} />
      </div>
    </ActionsPopover>
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

function EditActions({ variable, onClickAction }: { variable: SceneVariable; onClickAction?: () => void }) {
  const styles = useStyles2(getStyles);

  const onEditVariable = useCallback(() => {
    const dashboard = sceneGraph.getAncestor(variable, DashboardScene);
    dashboard.state.editPane.selectObject(variable, variable.state.key!);
    onClickAction?.();
  }, [variable, onClickAction]);

  const onDeleteVariable = useCallback(() => {
    const set = variable.parent;
    if (set instanceof SceneVariableSet) {
      dashboardEditActions.removeVariable({ source: set, removedObject: variable });
    }
    onClickAction?.();
  }, [variable, onClickAction]);

  return (
    <div className={styles.hoverActions}>
      <IconButton
        name="pen"
        variant="primary"
        size="md"
        className={cx(styles.action, styles.editAction)}
        onClick={onEditVariable}
        aria-label={t('dashboard-scene.edit-actions.aria-label-edit-variable', 'Edit variable')}
      />
      <div className={styles.actionsDivider} />
      <IconButton
        name="trash-alt"
        variant="destructive"
        size="md"
        className={cx(styles.action, styles.deleteAction)}
        onClick={onDeleteVariable}
        aria-label={t('dashboard-scene.edit-actions.aria-label-delete-variable', 'Delete variable')}
      />
    </div>
  );
}

function ActionsPopover({ content, children }: { content: React.ReactNode | null; children: React.JSX.Element }) {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'top-start',
    middleware: [offset(0)],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { handleClose: safePolygon() });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  return (
    <>
      {cloneElement(children, { ref: refs.setReference, ...getReferenceProps() })}
      {isOpen && content && (
        <Portal>
          <div ref={refs.setFloating} style={floatingStyles} className={styles.popover} {...getFloatingProps()}>
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    zIndex: theme.zIndex.portal,
  }),
  hoverActions: css({
    display: 'flex',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z1,
    position: 'relative',
    top: '2px',
  }),
  actionsDivider: css({
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border.medium,
  }),
  action: css({
    margin: 0,
    color: theme.colors.text.primary,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['color'], {
        duration: theme.transitions.duration.short,
      }),
    },
  }),
  editAction: css({
    '&:hover': {
      color: theme.colors.primary.text,
    },
  }),
  deleteAction: css({
    '&:hover': {
      color: theme.colors.error.text,
    },
  }),
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
