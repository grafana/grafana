import { useMemo } from 'react';

import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Input } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ObjectRemovedFromCanvasEvent } from '../../edit-pane/shared';
import { BulkActionElement } from '../../scene/types/BulkActionElement';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';

export class VariableEditableElement implements EditableDashboardElement, BulkActionElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(public variable: SceneVariable) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.variable', 'Variable'),
      icon: 'chart-line',
      instanceName: this.variable.state.name,
    };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const variable = this.variable;

    const options = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({ title: '', id: 'panel-options' })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard-scene.variable-editor-form.name', 'Name'),
            value: variable.state.name,
            popularRank: 1,
            render: () => <VariableNameInput variable={variable} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard-scene.variable-editor-form.label', 'Label'),
            value: variable.state.label,
            description: t(
              'dashboard-scene.variable-editor-form.description-optional-display-name',
              'Optional display name'
            ),
            render: () => <VariableLabelInput variable={variable} />,
          })
        );
    }, [variable]);

    return [options];
  }

  public onDelete() {
    const set = this.variable.parent!;
    if (set instanceof SceneVariableSet) {
      this.variable.publishEvent(new ObjectRemovedFromCanvasEvent(this.variable), true);
      set.setState({ variables: set.state.variables.filter((v) => v !== this.variable) });
    }
  }
}

export function VariableNameInput({ variable }: { variable: SceneVariable }) {
  const { name } = variable.useState();
  return <Input value={name} onChange={(e) => variable.setState({ name: e.currentTarget.value })} />;
}

export function VariableLabelInput({ variable }: { variable: SceneVariable }) {
  const { label } = variable.useState();
  return <Input value={label} onChange={(e) => variable.setState({ label: e.currentTarget.value })} />;
}
