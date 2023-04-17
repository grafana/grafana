import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { useSelector } from 'app/types';

import { getLastKey, getVariablesByKey } from '../../../variables/state/selectors';

export interface Props {
  id?: string;
  repeat?: string | null;
  onChange: (name: string | null) => void;
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
        label: 'No template variables found',
        value: null,
      });
    }

    options.unshift({
      label: 'Disable repeating',
      value: null,
    });

    return options;
  }, [variables]);

  const onSelectChange = useCallback((option: SelectableValue<string | null>) => onChange(option.value!), [onChange]);

  return <Select inputId={id} value={repeat} onChange={onSelectChange} options={variableOptions} />;
};
