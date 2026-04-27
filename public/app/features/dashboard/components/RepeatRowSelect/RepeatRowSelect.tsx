import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SelectableValue } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { LocalValueVariable, type SceneObject, sceneGraph } from '@grafana/scenes';
import { Combobox, type ComboboxOption, Select } from '@grafana/ui';
import {
  collectAncestorSceneVariables,
  subscribeAncestorVariableSets,
} from 'app/features/dashboard-scene/utils/collectAncestorSceneVariables';
import { useSelector } from 'app/types/store';

import { getLastKey, getVariablesByKey } from '../../../variables/state/selectors';

export interface Props {
  id?: string;
  repeat?: string;
  onChange: (name?: string) => void;
}

export const RepeatRowSelect = ({ repeat, onChange, id }: Props) => {
  const variables = useSelector((state) => {
    return getVariablesByKey(getLastKey(state), state);
  });

  const variableOptions = useMemo(() => {
    const options: Array<SelectableValue<string | null>> = variables.map((item) => {
      return { label: item.name, value: item.name };
    });

    if (options.length === 0) {
      options.unshift({
        label: t(
          'dashboard.repeat-row-select.variable-options.label.no-template-variables-found',
          'No template variables found'
        ),
        value: null,
      });
    }

    options.unshift({
      label: t('dashboard.repeat-row-select.variable-options.label.disable-repeating', 'Disable repeating'),
      value: null,
    });

    return options;
  }, [variables]);

  const onSelectChange = useCallback((option: SelectableValue<string | null>) => onChange(option.value!), [onChange]);

  return <Select inputId={id} value={repeat} onChange={onSelectChange} options={variableOptions} />;
};

interface Props2 {
  sceneContext: SceneObject;
  repeat: string | undefined;
  id?: string;
  onChange: (name?: string) => void;
}

export const RepeatRowSelect2 = ({ sceneContext, repeat, id, onChange }: Props2) => {
  const [ancestorVarsVersion, setAncestorVarsVersion] = useState(0);

  useEffect(() => {
    return subscribeAncestorVariableSets(sceneContext, () => {
      setAncestorVarsVersion((v) => v + 1);
    });
  }, [sceneContext]);

  const variables = useMemo(() => {
    return collectAncestorSceneVariables(sceneContext);
    // Recompute when any ancestor SceneVariableSet emits (see subscribeAncestorVariableSets).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ancestorVarsVersion is an intentional cache bust
  }, [sceneContext, ancestorVarsVersion]);

  const variableOptions = useMemo(() => {
    const options: ComboboxOption[] = variables
      .filter((item) => {
        if (sceneContext.parent) {
          // filter out local value variables (which are only set on repeated items)
          return !(sceneGraph.lookupVariable(item.state.name, sceneContext.parent) instanceof LocalValueVariable);
        }
        return true;
      })
      .map((item) => ({
        label: item.state.name,
        value: item.state.name,
      }));

    options.unshift({
      label: t('dashboard.repeat-row-select2.variable-options.label.disable-repeating', 'Disable repeating'),
      value: '',
    });

    return options;
  }, [sceneContext, variables]);

  const onSelectChange = useCallback((value: ComboboxOption | null) => value && onChange(value.value), [onChange]);

  const isDisabled = !repeat && variableOptions.length <= 1;

  return (
    <Combobox
      id={id}
      value={repeat || ''}
      onChange={onSelectChange}
      options={variableOptions}
      disabled={isDisabled}
      placeholder={
        isDisabled
          ? t(
              'dashboard.repeat-row-select2.variable-options.label.no-template-variables-found',
              'No template variables found'
            )
          : t('dashboard.repeat-row-select2.placeholder', 'Choose')
      }
    />
  );
};
