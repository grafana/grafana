import { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LocalValueVariable, SceneObject, sceneGraph } from '@grafana/scenes';
import { Combobox, ComboboxOption, Select } from '@grafana/ui';
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
  const sceneVars = useMemo(() => sceneGraph.getVariables(sceneContext.getRoot()), [sceneContext]);
  const variables = sceneVars.useState().variables;
  const existingRepeat = useExistingRepeat(sceneContext);

  const variableOptions = useMemo(() => {
    const options: ComboboxOption[] = variables
      .filter((item) => !existingRepeat.has(item.state.name))
      .map((item) => ({
        label: item.state.name,
        value: item.state.name,
      }));

    options.unshift({
      label: t('dashboard.repeat-row-select2.variable-options.label.disable-repeating', 'Disable repeating'),
      value: '',
    });

    return options;
  }, [existingRepeat, variables]);

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

function useExistingRepeat(sceneContext: SceneObject) {
  return useMemo<Set<string>>(() => {
    const repeats = new Set<string>();

    findRepeatedAncestors(sceneContext, repeats);
    findRepeatedDescendent(sceneContext, repeats);

    return repeats;
  }, [sceneContext]);
}

function findRepeatedAncestors(o: SceneObject, repeats: Set<string>) {
  let p = o.parent;

  while (p) {
    const localVar = p.state.$variables?.state.variables.find((v) => v instanceof LocalValueVariable);
    if (localVar) {
      repeats.add(localVar.state.name);
    }
    p = p.parent;
  }
}

function findRepeatedDescendent(o: SceneObject, repeats: Set<string>, tab = '') {
  o.forEachChild((c) => {
    // skip clones
    if ('repeatSourceKey' in c.state && c.state.repeatSourceKey) {
      return;
    }

    const localVar = c.state.$variables?.state.variables.find((v) => v instanceof LocalValueVariable);
    if (localVar) {
      repeats.add(localVar.state.name);
    }

    findRepeatedDescendent(c, repeats, tab + '  ');
  });
}
