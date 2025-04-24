import { useMemo } from 'react';

import { LocalValueVariable } from '@grafana/scenes';
import { Box, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';

export class LocalVariableEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(public variable: LocalValueVariable) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.local-variable', 'Local variable'),
      icon: 'dollar-alt',
      instanceName: ` $${this.variable.state.name} = ${this.variable.getValueText!()}`,
      isHidden: true,
    };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const variable = this.variable;

    return useMemo(() => {
      const category = new OptionsPaneCategoryDescriptor({
        title: '',
        id: 'local-variable-options',
      });

      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          skipField: true,
          render: () => {
            return (
              <Box paddingBottom={1}>
                <Stack>
                  <Stack>
                    <span>${variable.state.name}</span>
                    <span>=</span>
                    <span>{variable.getValueText()}</span>
                  </Stack>
                </Stack>
              </Box>
            );
          },
        })
      );

      return [category];
    }, [variable]);
  }
}
