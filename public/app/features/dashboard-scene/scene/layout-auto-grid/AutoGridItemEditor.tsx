import { t } from '@grafana/i18n';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

import { useConditionalRenderingEditor } from '../../conditional-rendering/ConditionalRenderingEditor';
import { dashboardEditActions } from '../../edit-pane/shared';

import { AutoGridItem } from './AutoGridItem';

export function getOptions(model: AutoGridItem): OptionsPaneCategoryDescriptor[] {
  const repeatCategory = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.auto-grid.item-options.repeat.title', 'Repeat options'),
    id: 'repeat-options',
    isOpenDefault: false,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.auto-grid.item-options.repeat.variable.title', 'Repeat by variable'),
      id: 'repeat-by-variable-select',
      description: t(
        'dashboard.auto-grid.item-options.repeat.variable.description',
        'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.'
      ),
      render: (descriptor) => <RepeatByOption id={descriptor.props.id} item={model} />,
    })
  );

  const conditionalRenderingCategory = useConditionalRenderingEditor(model.state.conditionalRendering)!;

  return [repeatCategory, conditionalRenderingCategory];
}

function RepeatByOption({ item, id }: { item: AutoGridItem; id?: string }) {
  const { variableName } = item.useState();

  return (
    <RepeatRowSelect2
      id={id}
      sceneContext={item}
      repeat={variableName}
      onChange={(value?: string) => {
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-repeat-variable', 'Panel repeat by'),
          source: item,
          perform: () => item.setRepeatByVariable(value),
          undo: () => item.setRepeatByVariable(variableName),
        });
      }}
    />
  );
}
