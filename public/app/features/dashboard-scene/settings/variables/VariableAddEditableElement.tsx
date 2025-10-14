import { css } from '@emotion/css';
import { useCallback, useId, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Box, Card, Stack, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../../scene/DashboardScene';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../../utils/interactions';

import { EditableVariableType, getNextAvailableId, getVariableScene, getVariableTypeSelectOptions } from './utils';

export function openAddVariablePane(dashboard: DashboardScene) {
  const element = new VariableAdd({ dashboardRef: dashboard.getRef() });
  dashboard.state.editPane.selectObject(element, element.state.key!, { force: true, multi: false });
}

export interface VariableAddState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class VariableAdd extends SceneObjectBase<VariableAddState> {}

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

function VariableTypeSelection({ variableAdd }: { variableAdd: VariableAdd }) {
  const options = useMemo(() => getVariableTypeSelectOptions(), []);
  const styles = useStyles2(getStyles);

  const onAddVariable = useCallback(
    (type: EditableVariableType) => {
      const dashboard = variableAdd.state.dashboardRef.resolve();
      const { editPane, $variables } = dashboard.state;
      const { variables } = $variables?.state ?? { variables: [] };
      const nextName = getNextAvailableId(type, variables);
      const newVar = getVariableScene(type, { name: nextName });

      dashboardEditActions.addVariable({
        source: variableAdd,
        addedObject: newVar,
      });

      editPane.selectObject(newVar, newVar.state.key!, { force: true, multi: false });

      DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
    },
    [variableAdd]
  );

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
            onClick={() => onAddVariable(option.value!)}
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
