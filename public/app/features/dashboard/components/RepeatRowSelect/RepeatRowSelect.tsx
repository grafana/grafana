import React, { FC, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { getVariables } from '../../../variables/state/selectors';
import { StoreState } from '../../../../types';

export interface Props {
  repeat: string | undefined | null;
  onChange: (name: string | null | undefined) => void;
}

export const RepeatRowSelect: FC<Props> = ({ repeat, onChange }) => {
  const variables = useSelector((state: StoreState) => getVariables(state));

  const variableOptions = useMemo(() => {
    const options = variables.map((item: any) => {
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
  }, variables);

  const onSelectChange = useCallback((option: SelectableValue<string | null>) => onChange(option.value), [onChange]);

  return <Select value={repeat} onChange={onSelectChange} options={variableOptions} />;
};
