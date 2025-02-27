import { SelectableValue } from '@grafana/data';
import { sceneGraph, SceneGridLayout } from '@grafana/scenes';
import { RadioButtonGroup, Select } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

import { DashboardGridItem } from './DashboardGridItem';

export function getDashboardGridItemOptions(gridItem: DashboardGridItem): OptionsPaneCategoryDescriptor {
  const category = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.default-layout.item-options.repeat.title', 'Repeat options'),
    id: 'Repeat options',
    isOpenDefault: false,
  });

  category.addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.default-layout.item-options.repeat.variable.title', 'Repeat by variable'),
      description: t(
        'dashboard.default-layout.item-options.repeat.variable.description',
        'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.'
      ),
      render: () => <RepeatByOption gridItem={gridItem} />,
    })
  );

  category.addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.default-layout.item-options.repeat.direction.title', 'Repeat direction'),
      useShowIf: () => {
        const { variableName } = gridItem.useState();
        return Boolean(variableName);
      },
      render: () => <RepeatDirectionOption gridItem={gridItem} />,
    })
  );

  category.addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.default-layout.item-options.repeat.max', 'Max per row'),
      useShowIf: () => {
        const { variableName, repeatDirection } = gridItem.useState();
        return Boolean(variableName) && repeatDirection === 'h';
      },
      render: () => <MaxPerRowOption gridItem={gridItem} />,
    })
  );

  return category;
}

interface OptionComponentProps {
  gridItem: DashboardGridItem;
}

function RepeatDirectionOption({ gridItem }: OptionComponentProps) {
  const { repeatDirection } = gridItem.useState();

  const directionOptions: Array<SelectableValue<'h' | 'v'>> = [
    { label: t('dashboard.default-layout.item-options.repeat.direction.horizontal', 'Horizontal'), value: 'h' },
    { label: t('dashboard.default-layout.item-options.repeat.direction.vertical', 'Vertical'), value: 'v' },
  ];

  return (
    <RadioButtonGroup
      options={directionOptions}
      value={repeatDirection ?? 'h'}
      onChange={(value) => gridItem.setRepeatDirection(value)}
    />
  );
}

function MaxPerRowOption({ gridItem }: OptionComponentProps) {
  const { maxPerRow } = gridItem.useState();
  const maxPerRowOptions: Array<SelectableValue<number>> = [2, 3, 4, 6, 8, 12].map((value) => ({
    label: value.toString(),
    value,
  }));

  return (
    <Select
      options={maxPerRowOptions}
      value={maxPerRow ?? 4}
      onChange={(value) => gridItem.setMaxPerRow(value.value)}
    />
  );
}

function RepeatByOption({ gridItem }: OptionComponentProps) {
  const { variableName, width } = gridItem.useState();

  return (
    <RepeatRowSelect2
      id="repeat-by-variable-select"
      sceneContext={gridItem}
      repeat={variableName}
      onChange={(value?: string) => {
        if (value !== variableName) {
          gridItem.setRepeatByVariable(value);
          gridItem.handleVariableName();

          if (width !== 24) {
            gridItem.setState({ width: 24 });
            sceneGraph.getAncestor(gridItem, SceneGridLayout).forceRender();
          }
        }
      }}
    />
  );
}
