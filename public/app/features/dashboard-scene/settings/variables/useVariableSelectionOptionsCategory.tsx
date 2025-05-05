import { useCallback, useMemo, useRef } from 'react';

import { MultiValueVariable, SceneVariableValueChangedEvent } from '@grafana/scenes';
import { Input, Switch } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

export function useVariableSelectionOptionsCategory(variable: MultiValueVariable): OptionsPaneCategoryDescriptor {
  return useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.edit-pane.variable.selection-options.category', 'Selection options'),
      id: 'selection-options-category',
      isOpenDefault: true,
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.edit-pane.variable.selection-options.multi-value', 'Multi-value'),
          render: () => <MultiValueSwitch variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.edit-pane.variable.selection-options.include-all', 'Include All option'),
          description: t(
            'dashboard.edit-pane.variable.selection-options.include-all-description',
            'Enables an option to include all values'
          ),
          render: () => <IncludeAllSwitch variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.edit-pane.variable.selection-options.custom-all-value', 'Custom all value'),
          description: t(
            'dashboard.edit-pane.variable.selection-options.custom-all-value-description',
            'A wildcard regex or other value to represent All'
          ),
          useShowIf: () => {
            return variable.useState().includeAll ?? false;
          },
          render: () => <CustomAllValueInput variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.edit-pane.variable.selection-options.allow-custom-values', 'Allow custom values'),
          description: t(
            'dashboard.edit-pane.variable.selection-options.allow-custom-values-description',
            'Enables users to enter values'
          ),
          render: () => <AllowCustomSwitch variable={variable} />,
        })
      );
  }, [variable]);
}

function MultiValueSwitch({ variable }: { variable: MultiValueVariable }) {
  const { isMulti } = variable.useState();

  return <Switch value={isMulti} onChange={(evt) => variable.setState({ isMulti: evt.currentTarget.checked })} />;
}

function IncludeAllSwitch({ variable }: { variable: MultiValueVariable }) {
  const { includeAll } = variable.useState();

  return <Switch value={includeAll} onChange={(evt) => variable.setState({ includeAll: evt.currentTarget.checked })} />;
}

function AllowCustomSwitch({ variable }: { variable: MultiValueVariable }) {
  const { allowCustomValue } = variable.useState();

  return (
    <Switch
      value={allowCustomValue}
      onChange={(evt) => variable.setState({ allowCustomValue: evt.currentTarget.checked })}
    />
  );
}

function CustomAllValueInput({ variable }: { variable: MultiValueVariable }) {
  const { allValue } = variable.useState();
  const ref = useRef<HTMLInputElement>(null);

  const onInputBlur = useCallback(
    (evt: React.FocusEvent<HTMLInputElement>) => {
      const newValue = evt.currentTarget.value;
      if (newValue === variable.state.allValue) {
        return;
      }

      variable.setState({ allValue: newValue });
      if (variable.hasAllValue()) {
        variable.publishEvent(new SceneVariableValueChangedEvent(variable), true);
      }
    },
    [variable]
  );

  return <Input ref={ref} defaultValue={allValue ?? ''} onBlur={onInputBlur} />;
}
