import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

import { useConditionalRenderingEditor } from '../../conditional-rendering/ConditionalRenderingEditor';

import { AutoGridItem } from './AutoGridItem';

export function getOptions(model: AutoGridItem): OptionsPaneCategoryDescriptor[] {
  const repeatCategory = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.auto-grid.item-options.repeat.title', 'Repeat options'),
    id: 'repeat-options',
    isOpenDefault: false,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.auto-grid.item-options.repeat.variable.title', 'Repeat by variable'),
      description: t(
        'dashboard.auto-grid.item-options.repeat.variable.description',
        'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.'
      ),
      render: () => <RepeatByOption item={model} />,
    })
  );

  const conditionalRenderingCategory = useConditionalRenderingEditor(model.state.conditionalRendering)!;

  return [repeatCategory, conditionalRenderingCategory];
}

function RepeatByOption({ item }: { item: AutoGridItem }) {
  const { variableName } = item.useState();

  return (
    <RepeatRowSelect2
      id="repeat-by-variable-select"
      sceneContext={item}
      repeat={variableName}
      onChange={(value?: string) => item.setRepeatByVariable(value)}
    />
  );
}
