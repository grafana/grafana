import { useCallback, useId, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { type MultiValueVariable, SceneVariableValueChangedEvent } from '@grafana/scenes';
import { Input, Switch } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { undoableVariableEdit } from '../../actions/variable/undoableVariableEdit';

function useVariableHasMultiProps(variable: MultiValueVariable) {
  const state = variable.useState();
  const hasMultiProps = 'valuesFormat' in state && state.valuesFormat === 'json';
  return hasMultiProps;
}

export function useVariableSelectionOptionsCategory(variable: MultiValueVariable): OptionsPaneCategoryDescriptor {
  const multiValueId = useId();
  const includeAllId = useId();
  const customAllValueId = useId();
  const allowCustomId = useId();

  return useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.sidebar.variable.selection-options.category', 'Selection options'),
      id: 'selection-options-category',
      isOpenDefault: true,
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.sidebar.variable.selection-options.multi-value', 'Multi-value'),
          id: multiValueId,
          render: (descriptor) => <MultiValueSwitch id={descriptor.props.id} variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.sidebar.variable.selection-options.include-all', 'Include All value'),
          id: includeAllId,
          description: t(
            'dashboard.sidebar.variable.selection-options.include-all-description',
            'Enables a single option that represent all values'
          ),
          render: (descriptor) => <IncludeAllSwitch id={descriptor.props.id} variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.sidebar.variable.selection-options.custom-all-value', 'Custom all value'),
          id: customAllValueId,
          description: t(
            'dashboard.sidebar.variable.selection-options.custom-all-value-description',
            'A wildcard regex or other value to represent All'
          ),
          useShowIf: () => {
            const state = variable.useState();
            const hasMultiProps = useVariableHasMultiProps(variable);
            return hasMultiProps ? false : (state.includeAll ?? false);
          },
          render: (descriptor) => <CustomAllValueInput id={descriptor.props.id} variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.sidebar.variable.selection-options.allow-custom-values', 'Allow custom values'),
          id: allowCustomId,
          description: t(
            'dashboard.sidebar.variable.selection-options.allow-custom-values-description',
            'Enables users to enter values'
          ),
          useShowIf: () => {
            const hasMultiProps = useVariableHasMultiProps(variable);
            return !hasMultiProps;
          },
          render: (descriptor) => <AllowCustomSwitch id={descriptor.props.id} variable={variable} />,
        })
      );
  }, [allowCustomId, customAllValueId, includeAllId, multiValueId, variable]);
}

interface InputProps {
  variable: MultiValueVariable;
  id?: string;
}

function MultiValueSwitch({ variable, id }: InputProps) {
  const { isMulti } = variable.useState();

  const onChange = (newIsMulti: boolean) => {
    undoableVariableEdit(true, {
      meta: { actionId: 'variable.changeMultiValue' },
      source: variable,
      description: t('dashboard.edit-actions.variable-multi-value', 'Change variable multi-value'),
      perform: () => variable.setState({ isMulti: newIsMulti }),
      undo: () => variable.setState({ isMulti }),
    });
  };

  return <Switch id={id} value={Boolean(isMulti)} onChange={(evt) => onChange(evt.currentTarget.checked)} />;
}

function IncludeAllSwitch({ variable, id }: InputProps) {
  const { includeAll } = variable.useState();

  const onChange = (newIncludeAll: boolean) => {
    undoableVariableEdit(true, {
      meta: { actionId: 'variable.changeIncludeAll' },
      source: variable,
      description: t('dashboard.edit-actions.variable-include-all', 'Change variable include All value'),
      perform: () => variable.setState({ includeAll: newIncludeAll }),
      undo: () => variable.setState({ includeAll }),
    });
  };

  return <Switch id={id} value={Boolean(includeAll)} onChange={(evt) => onChange(evt.currentTarget.checked)} />;
}

function AllowCustomSwitch({ variable, id }: InputProps) {
  const { allowCustomValue } = variable.useState();

  const onChange = (newAllowCustomValue: boolean) => {
    undoableVariableEdit(true, {
      meta: { actionId: 'variable.changeAllowCustomValue', scope: variable.state.type },
      source: variable,
      description: t('dashboard.edit-actions.variable-allow-custom-value', 'Change variable allow custom values'),
      perform: () => variable.setState({ allowCustomValue: newAllowCustomValue }),
      undo: () => variable.setState({ allowCustomValue }),
    });
  };

  return <Switch id={id} value={allowCustomValue ?? true} onChange={(evt) => onChange(evt.currentTarget.checked)} />;
}

function CustomAllValueInput({ variable, id }: InputProps) {
  const { allValue } = variable.useState();
  const ref = useRef<HTMLInputElement>(null);

  const onInputBlur = useCallback(
    (evt: React.FocusEvent<HTMLInputElement>) => {
      const newValue = evt.currentTarget.value;
      const oldValue = variable.state.allValue;
      if (newValue === oldValue) {
        return;
      }

      const applyAllValue = (value: string | undefined) => {
        variable.setState({ allValue: value });
        if (variable.hasAllValue()) {
          variable.publishEvent(new SceneVariableValueChangedEvent(variable), true);
        }
      };

      undoableVariableEdit(true, {
        meta: { actionId: 'variable.changeAllValue' },
        source: variable,
        description: t('dashboard.edit-actions.variable-custom-all-value', 'Change variable custom all value'),
        perform: () => applyAllValue(newValue),
        undo: () => applyAllValue(oldValue),
      });
    },
    [variable]
  );

  // The input is uncontrolled, remount it when the value changes outside of it (e.g. undo/redo)
  return <Input key={allValue ?? ''} id={id} ref={ref} defaultValue={allValue ?? ''} onBlur={onInputBlur} />;
}
