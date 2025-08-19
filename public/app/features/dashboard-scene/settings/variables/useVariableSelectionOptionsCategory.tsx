import { useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { t } from '@grafana/i18n';
import { MultiValueVariable, SceneVariableValueChangedEvent } from '@grafana/scenes';
import { Input, Switch } from '@grafana/ui';
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
          id: uuidv4(),
          render: (descriptor) => <MultiValueSwitch id={descriptor.props.id} variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.edit-pane.variable.selection-options.include-all', 'Include All value'),
          id: uuidv4(),
          description: t(
            'dashboard.edit-pane.variable.selection-options.include-all-description',
            'Enables a single option that represent all values'
          ),
          render: (descriptor) => <IncludeAllSwitch id={descriptor.props.id} variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.edit-pane.variable.selection-options.custom-all-value', 'Custom all value'),
          id: uuidv4(),
          description: t(
            'dashboard.edit-pane.variable.selection-options.custom-all-value-description',
            'A wildcard regex or other value to represent All'
          ),
          useShowIf: () => {
            return variable.useState().includeAll ?? false;
          },
          render: (descriptor) => <CustomAllValueInput id={descriptor.props.id} variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.edit-pane.variable.selection-options.allow-custom-values', 'Allow custom values'),
          id: uuidv4(),
          description: t(
            'dashboard.edit-pane.variable.selection-options.allow-custom-values-description',
            'Enables users to enter values'
          ),
          render: (descriptor) => <AllowCustomSwitch id={descriptor.props.id} variable={variable} />,
        })
      );
  }, [variable]);
}

interface InputProps {
  variable: MultiValueVariable;
  id?: string;
}

function MultiValueSwitch({ variable, id }: InputProps) {
  const { isMulti } = variable.useState();

  return (
    <Switch id={id} value={isMulti} onChange={(evt) => variable.setState({ isMulti: evt.currentTarget.checked })} />
  );
}

function IncludeAllSwitch({ variable, id }: InputProps) {
  const { includeAll } = variable.useState();

  return (
    <Switch
      id={id}
      value={includeAll}
      onChange={(evt) => variable.setState({ includeAll: evt.currentTarget.checked })}
    />
  );
}

function AllowCustomSwitch({ variable, id }: InputProps) {
  const { allowCustomValue } = variable.useState();

  return (
    <Switch
      id={id}
      value={allowCustomValue}
      onChange={(evt) => variable.setState({ allowCustomValue: evt.currentTarget.checked })}
    />
  );
}

function CustomAllValueInput({ variable, id }: InputProps) {
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

  return <Input id={id} ref={ref} defaultValue={allValue ?? ''} onBlur={onInputBlur} />;
}
