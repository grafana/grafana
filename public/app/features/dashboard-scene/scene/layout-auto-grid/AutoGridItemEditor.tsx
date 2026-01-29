import { t } from '@grafana/i18n';
import { Input } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

import { useConditionalRenderingEditor } from '../../conditional-rendering/hooks/useConditionalRenderingEditor';
import { dashboardEditActions } from '../../edit-pane/shared';
import { splitByLabelProcessorFactory } from '../../serialization/layoutSerializers/AutoGridLayoutSerializer';
import { getQueryRunnerFor } from '../../utils/utils';

import { AutoGridItem } from './AutoGridItem';

export function getOptions(model: AutoGridItem): OptionsPaneCategoryDescriptor[] {
  const repeatCategory = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.auto-grid.item-options.repeat.title', 'Repeat options'),
    id: 'repeat-options',
    isOpenDefault: false,
  })
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.auto-grid.item-options.repeat.variable.title', 'Repeat by variable'),
        id: 'auto-grid-repeat-by-variable',
        description: t(
          'dashboard.auto-grid.item-options.repeat.variable.description',
          'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.'
        ),
        render: (descriptor) => <RepeatByOption id={descriptor.props.id} item={model} />,
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.auto-grid.item-options.repeat.splitByLabel.title', 'Split series by label'),
        id: 'auto-grid-split-series-by-label',
        description: t(
          'dashboard.auto-grid.item-options.repeat.splitByLabel.description',
          'Repeat this panel by splitting the returned series by a label key (for example `cluster`).'
        ),
        render: (descriptor) => <SplitSeriesByLabelOption id={descriptor.props.id} item={model} />,
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
          perform: () => {
            // Repeat modes are mutually exclusive; disable split-by-label processor when using variable repeat.
            const queryRunner = getQueryRunnerFor(item.state.body);
            queryRunner?.setState({ dataProcessor: undefined });
            item.setState({ splitSeriesByLabel: undefined, repeatedPanels: [] });
            item.setRepeatByVariable(value);
          },
          undo: () => {
            const queryRunner = getQueryRunnerFor(item.state.body);
            queryRunner?.setState({ dataProcessor: undefined });
            item.setState({ splitSeriesByLabel: undefined, repeatedPanels: [] });
            item.setRepeatByVariable(variableName);
          },
        });
      }}
    />
  );
}

function SplitSeriesByLabelOption({ item, id }: { item: AutoGridItem; id?: string }) {
  const { splitSeriesByLabel, variableName } = item.useState();

  return (
    <Input
      id={id}
      width={32}
      value={splitSeriesByLabel ?? ''}
      placeholder={t('dashboard.auto-grid.item-options.repeat.splitByLabel.placeholder', 'cluster')}
      disabled={Boolean(variableName)}
      onChange={(e) => {
        const next = e.currentTarget.value.trim() || undefined;
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-split-series-by-label', 'Split series by label'),
          source: item,
          perform: () => {
            // Disable variable repeat when enabling split-by-label.
            if (item.state.variableName) {
              item.setRepeatByVariable(undefined);
            }
            item.setState({ splitSeriesByLabel: next, repeatedPanels: [] });

            const queryRunner = getQueryRunnerFor(item.state.body);
            queryRunner?.setState({ dataProcessor: next ? splitByLabelProcessorFactory(next) : undefined });
          },
          undo: () => {
            // Restore previous state.
            if (variableName) {
              item.setRepeatByVariable(variableName);
            } else {
              item.setRepeatByVariable(undefined);
            }
            item.setState({ splitSeriesByLabel, repeatedPanels: [] });

            const queryRunner = getQueryRunnerFor(item.state.body);
            queryRunner?.setState({
              dataProcessor: splitSeriesByLabel ? splitByLabelProcessorFactory(splitSeriesByLabel) : undefined,
            });
          },
        });
      }}
    />
  );
}
