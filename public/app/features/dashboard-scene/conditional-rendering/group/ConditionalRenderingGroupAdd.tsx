import { useMemo } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ValuePicker } from '@grafana/ui';

import { DashboardInteractions } from '../../utils/interactions';
import { conditionRegistry } from '../conditions/conditionRegistry';
import { ObjectsWithConditionalRendering } from '../object';

import { type GroupConditionConditionType } from './types';

interface Props {
  objectType: ObjectsWithConditionalRendering;
  hasVariables: boolean;
  onAdd: (option: SelectableValue<string>) => void;
}

export const ConditionalRenderingGroupAdd = ({ objectType, hasVariables, onAdd }: Props) => {
  const options = useMemo<Array<SelectableValue<string>>>(() => {
    return conditionRegistry
      .list()
      .filter((item) => {
        if (item.isApplicable && !item.isApplicable(objectType)) {
          return false;
        }
        return true;
      })
      .map((item) => ({
        label: item.name,
        value: item.id,
        // Disable the variable condition when there are no variables defined
        isDisabled: item.id === 'ConditionalRenderingVariable' && !hasVariables,
      }));
  }, [objectType, hasVariables]);

  const onAddRuleClick = (option: SelectableValue<GroupConditionConditionType>) => {
    DashboardInteractions.clickAddConditionalRuleButton({ ruleId: option.value! });
    onAdd(option);
  };

  return (
    <ValuePicker
      isFullWidth
      size="sm"
      icon="plus"
      variant="secondary"
      label={t('dashboard.conditional-rendering.conditions.group.add.button', 'Add rule')}
      options={options}
      onChange={(option) => onAddRuleClick(option)}
    />
  );
};
