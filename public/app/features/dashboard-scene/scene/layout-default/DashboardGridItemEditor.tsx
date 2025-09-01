import { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { sceneGraph, SceneGridLayout } from '@grafana/scenes';
import { RadioButtonGroup, Select } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

import { useConditionalRenderingEditor } from '../../conditional-rendering/ConditionalRenderingEditor';
import { dashboardEditActions } from '../../edit-pane/shared';

import { DashboardGridItem } from './DashboardGridItem';

export function getDashboardGridItemOptions(gridItem: DashboardGridItem): OptionsPaneCategoryDescriptor[] {
  const categoryId = 'repeat-options';
  const repeatCategory = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.default-layout.item-options.repeat.title', 'Repeat options'),
    id: categoryId,
    isOpenDefault: false,
  })
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.default-layout.item-options.repeat.variable.title', 'Repeat by variable'),
        id: `${categoryId}-repeat-by-variable`,
        description: t(
          'dashboard.default-layout.item-options.repeat.variable.description',
          'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.'
        ),
        render: (descriptor) => <RepeatByOption id={descriptor.props.id} gridItem={gridItem} />,
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.default-layout.item-options.repeat.direction.title', 'Repeat direction'),
        id: `${categoryId}-repeat-direction`,
        useShowIf: () => {
          const { variableName } = gridItem.useState();
          return Boolean(variableName);
        },
        render: () => <RepeatDirectionOption gridItem={gridItem} />,
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.default-layout.item-options.repeat.max', 'Max per row'),
        id: `${categoryId}-max-per-row`,
        useShowIf: () => {
          const { variableName, repeatDirection } = gridItem.useState();
          return Boolean(variableName) && repeatDirection === 'h';
        },
        render: (descriptor) => <MaxPerRowOption id={descriptor.props.id} gridItem={gridItem} />,
      })
    );

  const conditionalRenderingCategory = useConditionalRenderingEditor(
    undefined,
    t(
      'dashboard.conditional-rendering.editor.not-supported-for-custom-grid',
      'Conditional rendering is not supported for the custom grid layout. Switch to auto grid to use conditional rendering.'
    )
  );

  const options = [repeatCategory];

  if (config.featureToggles.dashboardNewLayouts) {
    options.push(conditionalRenderingCategory);
  }

  return options;
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
      onChange={(value) => {
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-repeat-direction', 'Repeat direction'),
          source: gridItem,
          perform: () => gridItem.setRepeatDirection(value),
          undo: () => gridItem.setRepeatDirection(repeatDirection ?? 'h'),
        });
      }}
    />
  );
}

function MaxPerRowOption({ gridItem, id }: OptionComponentProps & { id?: string }) {
  const { maxPerRow } = gridItem.useState();
  const maxPerRowOptions: Array<SelectableValue<number>> = [2, 3, 4, 6, 8, 12].map((value) => ({
    label: value.toString(),
    value,
  }));

  return (
    <Select
      id={id}
      options={maxPerRowOptions}
      value={maxPerRow ?? 4}
      onChange={(value) => {
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-max-repeats-per-row', 'Max repeats per row'),
          source: gridItem,
          perform: () => gridItem.setMaxPerRow(value.value),
          undo: () => gridItem.setMaxPerRow(maxPerRow ?? 4),
        });
      }}
    />
  );
}

function RepeatByOption({ gridItem, id }: OptionComponentProps & { id?: string }) {
  const { variableName, width } = gridItem.useState();

  const handleStateChange = useCallback(
    (value?: string) => {
      gridItem.setRepeatByVariable(value);
      gridItem.handleVariableName();

      if (width !== 24) {
        gridItem.setState({ width: 24 });
        sceneGraph.getAncestor(gridItem, SceneGridLayout).forceRender();
      }
    },
    [gridItem, width]
  );

  const handleChange = useCallback(
    (value?: string) => {
      if (value !== variableName) {
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-repeat-variable', 'Panel repeat by'),
          source: gridItem,
          perform: () => handleStateChange(value),
          undo: () => handleStateChange(variableName),
        });
      }
    },
    [gridItem, handleStateChange, variableName]
  );

  return <RepeatRowSelect2 id={id} sceneContext={gridItem} repeat={variableName} onChange={handleChange} />;
}
