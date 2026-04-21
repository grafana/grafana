import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneVariable,
  SceneVariableSet,
} from '@grafana/scenes';
import { Box, Card, Sidebar, Stack, useStyles2 } from '@grafana/ui';

import { dashboardEditActions } from '../../edit-pane/shared';
import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import {
  type EditableVariableType,
  getNextAvailableId,
  getVariableNamePrefix,
  getVariableScene,
  getVariableTypeSelectOptions,
} from './utils';

export function openAddVariablePane(dashboard: DashboardScene) {
  dashboard.state.editPane.openPane(new VariableAddPane({ sectionOwner: dashboard.getRef() }));
}

export function openAddSectionVariablePane(dashboard: DashboardScene, sectionOwner: SceneObject) {
  dashboard.state.editPane.openPane(new VariableAddPane({ sectionOwner: sectionOwner.getRef() }));
}

export interface VariableAddPaneState extends SceneObjectState {
  sectionOwner: SceneObjectRef<SceneObject>;
}

export class VariableAddPane extends SceneObjectBase<VariableAddPaneState> {
  public static Component = VariableAddPaneRenderer;
  public getId() {
    return 'variable-type-selection' as const;
  }
}

export function VariableAddPaneRenderer({ model }: SceneComponentProps<VariableAddPane>) {
  const onAddVariable = useCallback(
    (type: EditableVariableType) => {
      const dashboard = getDashboardSceneFor(model);
      const sectionOwner = model.state.sectionOwner.resolve();
      const existing = sectionOwner.state.$variables;
      const variablesSet = existing instanceof SceneVariableSet ? existing : new SceneVariableSet({ variables: [] });

      if (!existing) {
        sectionOwner.setState({ $variables: variablesSet });
      }

      const sectionVars = variablesSet.state.variables ?? [];
      const newVar = getVariableScene(type, { name: getNextAvailableId(getVariableNamePrefix(type), sectionVars) });

      dashboardEditActions.addVariable({ source: variablesSet, addedObject: newVar });
      dashboard.state.editPane.selectObject(newVar, { force: true, multi: false });

      if (sectionOwner === dashboard) {
        DashboardInteractions.variableTypeSelected({ type });
      } else {
        DashboardInteractions.sectionVariableTypeSelected({ type });
      }
    },
    [model]
  );

  return (
    <>
      <Sidebar.PaneHeader title={t('dashboard.edit-pane.variables.select-type', 'Choose variable type')} />
      <Box padding={2}>
        <VariableTypeSelectionUI onSelectType={onAddVariable} />
      </Box>
    </>
  );
}

export interface VariableTypeChangePaneState extends SceneObjectState {
  variableRef: SceneObjectRef<SceneVariable>;
}

export class VariableTypeChangePane extends SceneObjectBase<VariableTypeChangePaneState> {
  public static Component = VariableTypeChangePaneRenderer;
  public getId() {
    return 'variable-type-selection' as const;
  }
}

export function openChangeVariableTypePane(variable: SceneVariable) {
  const dashboard = getDashboardSceneFor(variable);
  dashboard.state.editPane.openPane(new VariableTypeChangePane({ variableRef: variable.getRef() }));
}

function VariableTypeChangePaneRenderer({ model }: SceneComponentProps<VariableTypeChangePane>) {
  const onChangeVariableType = useCallback(
    (type: EditableVariableType) => {
      const variable = model.state.variableRef.resolve();
      const dashboard = getDashboardSceneFor(variable);
      const variableSet = variable.parent;

      if (!(variableSet instanceof SceneVariableSet)) {
        return;
      }

      if (type === variable.state.type) {
        dashboard.state.editPane.selectObject(variable, { force: true, multi: false });
        return;
      }

      const newVariable = getVariableScene(type, { name: variable.state.name, label: variable.state.label });

      dashboardEditActions.changeVariableType({
        source: variableSet,
        oldVariable: variable,
        newVariable,
      });

      DashboardInteractions.variableTypeChanged({ old: variable.state.type, new: newVariable.state.type });
    },
    [model]
  );

  return (
    <>
      <Sidebar.PaneHeader title={t('dashboard.edit-pane.variables.change-type', 'Change variable type')} />
      <Box padding={2}>
        <VariableTypeSelectionUI onSelectType={onChangeVariableType} />
      </Box>
    </>
  );
}

export function VariableTypeSelectionUI({ onSelectType }: { onSelectType: (type: EditableVariableType) => void }) {
  const options = useMemo(() => getVariableTypeSelectOptions(), []);
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={0}>
      <Box paddingBottom={1} display={'flex'}>
        <Trans i18nKey="dashboard.edit-pane.variables.select-type">Choose variable type</Trans>
      </Box>
      <Stack direction="column" gap={1}>
        {options.map((option) => (
          <Card
            noMargin
            isCompact
            onClick={() => onSelectType(option.value!)}
            key={option.value}
            title={t('dashboard.edit-pane.variables.select-type-card-tooltip', 'Click to select type')}
            data-testid={selectors.components.PanelEditor.ElementEditPane.variableType(option.value!)}
          >
            <Card.Heading>{option.label}</Card.Heading>
            <Card.Description className={styles.cardDescription}>{option.description}</Card.Description>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    cardDescription: css({
      fontSize: theme.typography.bodySmall.fontSize,
      marginTop: theme.spacing(0),
    }),
  };
}
