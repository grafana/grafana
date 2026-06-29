import { t } from '@grafana/i18n';
import { RadioButtonGroup } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

import { useConditionalRenderingEditor } from '../../conditional-rendering/hooks/useConditionalRenderingEditor';
import { dashboardEditActions } from '../../edit-pane/shared';

import { type AutoGridItem } from './AutoGridItem';

type FitContentOverride = 'default' | 'on' | 'off';

export function getOptions(model: AutoGridItem): OptionsPaneCategoryDescriptor[] {
  const categories: OptionsPaneCategoryDescriptor[] = [];

  // Only panels whose plugin supports content-fit can override the layout default.
  if (model.state.body.getPlugin()?.supportsFitContent === true) {
    categories.push(
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.auto-grid.item-options.fit-content.title', 'Auto fit content'),
        id: 'fit-content-options',
        isOpenDefault: false,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.auto-grid.item-options.fit-content.override.title', 'Auto fit content'),
          id: 'auto-grid-fit-content-override',
          description: t(
            'dashboard.auto-grid.item-options.fit-content.override.description',
            'Override the layout default for this panel. "Default" follows the layout setting.'
          ),
          render: () => <FitContentOption item={model} />,
        })
      )
    );
  }

  const repeatCategory = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.auto-grid.item-options.repeat.title', 'Repeat options'),
    id: 'repeat-options',
    isOpenDefault: false,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.auto-grid.item-options.repeat.variable.title', 'Repeat by variable'),
      id: 'auto-grid-repeat-by-variable',
      description: t(
        'dashboard.auto-grid.item-options.repeat.variable.description',
        'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.'
      ),
      render: (descriptor) => <RepeatByOption id={descriptor.props.id} item={model} />,
    })
  );

  const conditionalRenderingCategory = useConditionalRenderingEditor(model.state.conditionalRendering)!;

  return [...categories, repeatCategory, conditionalRenderingCategory];
}

function FitContentOption({ item }: { item: AutoGridItem }) {
  const { fitContent } = item.useState();
  const value: FitContentOverride = fitContent === undefined ? 'default' : fitContent ? 'on' : 'off';

  const options: Array<{ label: string; value: FitContentOverride }> = [
    { label: t('dashboard.auto-grid.item-options.fit-content.override.default', 'Default'), value: 'default' },
    { label: t('dashboard.auto-grid.item-options.fit-content.override.on', 'On'), value: 'on' },
    { label: t('dashboard.auto-grid.item-options.fit-content.override.off', 'Off'), value: 'off' },
  ];

  return (
    <RadioButtonGroup
      options={options}
      value={value}
      onChange={(next) => {
        const prev = item.state.fitContent;
        const nextValue = next === 'default' ? undefined : next === 'on';
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-fit-content', 'Panel auto fit content'),
          source: item,
          perform: () => item.setFitContent(nextValue),
          undo: () => item.setFitContent(prev),
        });
      }}
    />
  );
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
