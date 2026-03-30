import { t } from '@grafana/i18n';
import { Switch } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

import { useConditionalRenderingEditor } from '../../conditional-rendering/hooks/useConditionalRenderingEditor';
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
      id: 'auto-grid-repeat-by-variable',
      description: t(
        'dashboard.auto-grid.item-options.repeat.variable.description',
        'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.'
      ),
      render: (descriptor) => <RepeatByOption id={descriptor.props.id} item={model} />,
    })
  );

  const colorPaletteCategory = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.auto-grid.item-options.color-palette.title', 'Color palette'),
    id: 'color-palette-options',
    isOpenDefault: false,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.auto-grid.item-options.color-palette.lock.title', 'Lock color'),
      id: 'auto-grid-color-palette-lock',
      description: t(
        'dashboard.auto-grid.item-options.color-palette.lock.description',
        'When enabled, this panel keeps its own color and ignores any color palette set at the tab or row level.'
      ),
      render: (descriptor) => <ColorPaletteLockOption id={descriptor.props.id} item={model} />,
    })
  );

  const conditionalRenderingCategory = useConditionalRenderingEditor(model.state.conditionalRendering)!;

  return [repeatCategory, colorPaletteCategory, conditionalRenderingCategory];
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

function ColorPaletteLockOption({ item, id }: { item: AutoGridItem; id?: string }) {
  const { colorPaletteOverride } = item.useState();

  return (
    <Switch
      id={id}
      value={colorPaletteOverride ?? false}
      onChange={(e) => {
        const locked = e.currentTarget.checked;
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-color-palette-lock', 'Lock panel color'),
          source: item,
          perform: () => item.setState({ colorPaletteOverride: locked }),
          undo: () => item.setState({ colorPaletteOverride: colorPaletteOverride }),
        });
      }}
    />
  );
}
