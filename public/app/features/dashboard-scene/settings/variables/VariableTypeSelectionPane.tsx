import { css } from '@emotion/css';
import { useCallback, useId, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import {
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneVariable,
  SceneVariableSet,
  sceneGraph,
} from '@grafana/scenes';
import { Box, Card, Stack, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions } from '../../edit-pane/shared';
import { type DashboardScene } from '../../scene/DashboardScene';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import {
  type EditableVariableType,
  getEditableVariableDefinition,
  getNextAvailableId,
  getVariableScene,
  getVariableTypeSelectOptions,
} from './utils';

export function openAddVariablePane(dashboard: DashboardScene) {
  const element = new VariableAdd({ dashboardRef: dashboard.getRef() });
  dashboard.state.editPane.selectObject(element, element.state.key!, { force: true, multi: false });
}

export function openAddSectionVariablePane(dashboard: DashboardScene, sectionOwner: SceneObject) {
  const element = new SectionVariableAdd({
    dashboardRef: dashboard.getRef(),
    sectionOwnerRef: sectionOwner.getRef(),
  });
  dashboard.state.editPane.selectObject(element, element.state.key!, { force: true, multi: false });
}

export interface VariableAddState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class VariableAdd extends SceneObjectBase<VariableAddState> {}

export interface SectionVariableAddState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  sectionOwnerRef: SceneObjectRef<SceneObject>;
}

export class SectionVariableAdd extends SceneObjectBase<SectionVariableAddState> {}

export interface VariableTypeChangeState extends SceneObjectState {
  variableRef: SceneObjectRef<SceneVariable>;
}

export class VariableTypeChange extends SceneObjectBase<VariableTypeChangeState> {}

export function openChangeVariableTypePane(variable: SceneVariable) {
  const dashboard = getDashboardSceneFor(variable);
  const element = new VariableTypeChange({ variableRef: variable.getRef() });
  dashboard.state.editPane.selectObject(element, element.state.key!, { force: true, multi: false });
}

function useEditPaneOptions(
  this: VariableAddEditableElement,
  variableAdd: VariableAdd
): OptionsPaneCategoryDescriptor[] {
  const id = useId();
  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'variables' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id,
        skipField: true,
        render: () => <VariableTypeSelection variableAdd={variableAdd} />,
      })
    );
  }, [variableAdd, id]);

  return [options];
}

export class VariableAddEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(private variableAdd: VariableAdd) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.variable-set', 'Variables'),
      icon: 'x',
      instanceName: t('dashboard.edit-pane.elements.variable-set', 'Variables'),
    };
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.variableAdd);
}

function useSectionEditPaneOptions(
  this: SectionVariableAddEditableElement,
  sectionVariableAdd: SectionVariableAdd
): OptionsPaneCategoryDescriptor[] {
  const id = useId();
  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'section-variables' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id,
        skipField: true,
        render: () => <SectionVariableTypeSelection sectionVariableAdd={sectionVariableAdd} />,
      })
    );
  }, [sectionVariableAdd, id]);

  return [options];
}

export class SectionVariableAddEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(private sectionVariableAdd: SectionVariableAdd) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.section-variable', 'Section Variables'),
      icon: 'x',
      instanceName: t('dashboard.edit-pane.elements.section-variable', 'Section Variables'),
    };
  }

  public useEditPaneOptions = useSectionEditPaneOptions.bind(this, this.sectionVariableAdd);
}

function useTypeChangeEditPaneOptions(
  this: VariableTypeChangeEditableElement,
  variableTypeChange: VariableTypeChange
): OptionsPaneCategoryDescriptor[] {
  const id = useId();
  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'variable-type-change' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id,
        skipField: true,
        render: () => <VariableTypeChangeSelection variableTypeChange={variableTypeChange} />,
      })
    );
  }, [variableTypeChange, id]);

  return [options];
}

export class VariableTypeChangeEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(private variableTypeChange: VariableTypeChange) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const variable = this.variableTypeChange.state.variableRef.resolve();
    const variableEditorDef = getEditableVariableDefinition(variable.state.type);

    return {
      typeName: t('dashboard.edit-pane.elements.variable', '{{type}} variable', { type: variableEditorDef.name }),
      icon: 'dollar-alt',
      instanceName: variable.state.name,
    };
  }

  public useEditPaneOptions = useTypeChangeEditPaneOptions.bind(this, this.variableTypeChange);
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

/** @internal Exported for testing */
export function VariableTypeSelection({ variableAdd }: { variableAdd: VariableAdd }) {
  const onAddVariable = useCallback(
    (type: EditableVariableType) => {
      const dashboard = variableAdd.state.dashboardRef.resolve();
      const variablesSet = sceneGraph.getVariables(dashboard);

      if (!(variablesSet instanceof SceneVariableSet)) {
        return;
      }

      const dashboardVars = variablesSet.state.variables ?? [];
      const sectionVars = collectDescendantVariables(dashboard);
      const allVars = [...dashboardVars, ...sectionVars];

      const newVar = getVariableScene(type, { name: getNextAvailableId(type, allVars) });
      dashboardEditActions.addVariable({ source: variablesSet, addedObject: newVar });
      dashboard.state.editPane.selectObject(newVar, newVar.state.key!, { force: true, multi: false });
      DashboardInteractions.variableTypeSelected({ type });
    },
    [variableAdd]
  );

  return <VariableTypeSelectionUI onSelectType={onAddVariable} />;
}

function VariableTypeChangeSelection({ variableTypeChange }: { variableTypeChange: VariableTypeChange }) {
  const onChangeVariableType = useCallback(
    (type: EditableVariableType) => {
      const variable = variableTypeChange.state.variableRef.resolve();
      const dashboard = getDashboardSceneFor(variable);
      const variableSet = variable.parent;

      if (!(variableSet instanceof SceneVariableSet)) {
        return;
      }

      if (type === variable.state.type) {
        dashboard.state.editPane.selectObject(variable, variable.state.key!, { force: true, multi: false });
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
    [variableTypeChange]
  );

  return <VariableTypeSelectionUI onSelectType={onChangeVariableType} />;
}

function SectionVariableTypeSelection({ sectionVariableAdd }: { sectionVariableAdd: SectionVariableAdd }) {
  const onAddVariable = useCallback(
    (type: EditableVariableType) => {
      const dashboard = sectionVariableAdd.state.dashboardRef.resolve();
      const sectionOwner = sectionVariableAdd.state.sectionOwnerRef.resolve();

      const existing = sectionOwner.state.$variables;
      const variablesSet = existing instanceof SceneVariableSet ? existing : new SceneVariableSet({ variables: [] });

      if (!(existing instanceof SceneVariableSet)) {
        sectionOwner.setState({ $variables: variablesSet });
      }

      const dashboardVars = sceneGraph.getVariables(dashboard).state.variables ?? [];
      const sectionVars = variablesSet.state.variables ?? [];
      const allVars = [...dashboardVars, ...sectionVars];

      const newVar = getVariableScene(type, {
        name: getNextAvailableId(type, allVars),
      });
      dashboardEditActions.addVariable({ source: variablesSet, addedObject: newVar });
      dashboard.state.editPane.selectObject(newVar, newVar.state.key!, { force: true, multi: false });
      DashboardInteractions.sectionVariableTypeSelected({ type });
    },
    [sectionVariableAdd]
  );

  return <VariableTypeSelectionUI onSelectType={onAddVariable} />;
}

/** @internal Exported for testing */
export function collectDescendantVariables(sceneObject: SceneObject): SceneVariable[] {
  const result: SceneVariable[] = [];
  sceneObject.forEachChild((child) => {
    if (child.state.$variables instanceof SceneVariableSet) {
      result.push(...child.state.$variables.state.variables);
    }
    result.push(...collectDescendantVariables(child));
  });
  return result;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    cardDescription: css({
      fontSize: theme.typography.bodySmall.fontSize,
      marginTop: theme.spacing(0),
    }),
  };
}
