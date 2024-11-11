import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup, Select } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

import { DashboardGridItem } from './DashboardGridItem';

export function getDashboardGridItemOptions(gridItem: DashboardGridItem) {
  const category = new OptionsPaneCategoryDescriptor({
    title: 'Repeat options',
    id: 'Repeat options',
    isOpenDefault: false,
  });

  category.addItem(
    new OptionsPaneItemDescriptor({
      title: 'Repeat by variable',
      description:
        'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.',
      render: function renderRepeatOptions() {
        const { variableName } = gridItem.useState();

        return (
          <RepeatRowSelect2
            id="repeat-by-variable-select"
            sceneContext={gridItem}
            repeat={variableName}
            onChange={(value?: string) => gridItem.setRepeatByVariable(value)}
          />
        );
      },
    })
  );

  category.addItem(
    new OptionsPaneItemDescriptor({
      title: 'Repeat direction',
      showIf: () => Boolean(gridItem.state.variableName),
      render: function renderRepeatOptions() {
        const { repeatDirection } = gridItem.useState();

        const directionOptions: Array<SelectableValue<'h' | 'v'>> = [
          { label: 'Horizontal', value: 'h' },
          { label: 'Vertical', value: 'v' },
        ];

        return (
          <RadioButtonGroup
            options={directionOptions}
            value={repeatDirection ?? 'h'}
            onChange={(value) => gridItem.setState({ repeatDirection: value })}
          />
        );
      },
    })
  );

  category.addItem(
    new OptionsPaneItemDescriptor({
      title: 'Max per row',
      showIf: () => Boolean(gridItem.state.variableName && gridItem.state.repeatDirection === 'h'),
      render: function renderOption() {
        const { maxPerRow } = gridItem.useState();
        const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map((value) => ({ label: value.toString(), value }));

        return (
          <Select
            options={maxPerRowOptions}
            value={maxPerRow ?? 4}
            onChange={(value) => gridItem.setState({ maxPerRow: value.value })}
          />
        );
      },
    })
  );

  return category;
}
