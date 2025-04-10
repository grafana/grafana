import { MultiValueVariable } from '@grafana/scenes';
import { Switch } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

export function getVariableSelectionOptionsCategory(variable: MultiValueVariable): OptionsPaneCategoryDescriptor {
  return new OptionsPaneCategoryDescriptor({
    title: t('dashboard.variable-editor.selection-options.category', 'Selection options'),
    id: 'selection-options-category',
    isOpenDefault: true,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard-scene.selection-options-form.multi-value', 'Multi-value'),
      description: t(
        'dashboard-scene.selection-options-form.description-enables-multiple-values-selected',
        'Enables multiple values to be selected at the same time'
      ),
      render: () => <MultiValueSwitch variable={variable} />,
    })
  );
}

function MultiValueSwitch({ variable }: { variable: MultiValueVariable }) {
  const { isMulti } = variable.useState();

  return <Switch value={isMulti} onChange={(evt) => variable.setState({ isMulti: evt.currentTarget.checked })} />;
}
