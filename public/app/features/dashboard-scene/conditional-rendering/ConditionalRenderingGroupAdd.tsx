import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { ValuePicker } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { GroupConditionItemType, ItemsWithConditionalRendering } from './types';

interface Props {
  itemType: ItemsWithConditionalRendering;
  hasVariables: boolean;
  onAdd: (itemType: GroupConditionItemType) => void;
}

export const ConditionalRenderingGroupAdd = ({ itemType, hasVariables, onAdd }: Props) => {
  const options = useMemo<Array<SelectableValue<GroupConditionItemType>>>(() => {
    const allOptions: Array<SelectableValue<GroupConditionItemType>> = [
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

    if (itemType !== 'panel') {
      allOptions.shift();
    }

    return allOptions;
  }, [itemType, hasVariables]);

  return (
    <ValuePicker
      isFullWidth
      size="sm"
      icon="plus"
      variant="secondary"
      label={t('dashboard.conditional-rendering.conditions.group.add.button', 'Add rule')}
      options={options}
      onChange={({ value }) => onAdd(value!)}
    />
  );
};
