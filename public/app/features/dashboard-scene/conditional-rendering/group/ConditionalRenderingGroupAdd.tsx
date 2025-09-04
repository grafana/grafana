import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ValuePicker } from '@grafana/ui';

import { ObjectsWithConditionalRendering } from '../object';

import { GroupConditionConditionType } from './types';

interface Props {
  objectType: ObjectsWithConditionalRendering;
  hasVariables: boolean;
  onAdd: (option: SelectableValue<GroupConditionConditionType>) => void;
}

export const ConditionalRenderingGroupAdd = ({ objectType, hasVariables, onAdd }: Props) => {
  const options = useMemo<Array<SelectableValue<GroupConditionConditionType>>>(() => {
    const allOptions: Array<SelectableValue<GroupConditionConditionType>> = [
      { label: t('dashboard.conditional-rendering.conditions.group.add.data', 'Query result'), value: 'data' },
      {
        label: t('dashboard.conditional-rendering.conditions.group.add.variable', 'Template variable'),
        value: 'variable',
        isDisabled: !hasVariables,
      },
      {
        label: t('dashboard.conditional-rendering.conditions.group.add.time-range-size', 'Time range less than'),
        value: 'timeRangeSize',
      },
    ];

    if (objectType !== 'panel') {
      allOptions.shift();
    }

    return allOptions;
  }, [objectType, hasVariables]);

  return (
    <ValuePicker
      isFullWidth
      size="sm"
      icon="plus"
      variant="secondary"
      label={t('dashboard.conditional-rendering.conditions.group.add.button', 'Add rule')}
      options={options}
      onChange={(option) => onAdd(option)}
    />
  );
};
