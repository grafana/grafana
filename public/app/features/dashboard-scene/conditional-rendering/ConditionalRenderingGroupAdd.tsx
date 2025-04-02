import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { ValuePicker } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { GroupConditionItemType } from './types';

interface Props {
  hasVariables: boolean;
  onAdd: (itemType: GroupConditionItemType) => void;
}

export const ConditionalRenderingGroupAdd = ({ hasVariables, onAdd }: Props) => {
  const options: Array<SelectableValue<GroupConditionItemType>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.add.data', 'Query result'), value: 'data' },
      {
        label: t('dashboard.conditional-rendering.group.add.variable', 'Template variable'),
        value: 'variable',
        isDisabled: !hasVariables,
      },
      {
        label: t('dashboard.conditional-rendering.group.add.time-range-size', 'Time range less than'),
        value: 'timeRangeSize',
      },
    ],
    [hasVariables]
  );

  return (
    <ValuePicker
      isFullWidth
      size="sm"
      icon="plus"
      variant="secondary"
      label={t('dashboard.conditional-rendering.group.add.button', 'Add rule')}
      options={options}
      onChange={({ value }) => onAdd(value!)}
    />
  );
};
