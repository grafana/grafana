import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { Button, Icon, InlineField, InlineFieldRow } from '@grafana/ui';
import { Condition } from './Condition';
import { ClassicCondition, ExpressionQuery } from '../types';
import { defaultCondition } from '../utils/expressionTypes';

interface Props {
  query: ExpressionQuery;
  refIds: Array<SelectableValue<string>>;
  onChange: (query: ExpressionQuery) => void;
}

export const ClassicConditions: FC<Props> = ({ onChange, query, refIds }) => {
  const onConditionChange = (condition: ClassicCondition, index: number) => {
    query.conditions![index] = condition;
    onChange({
      ...query,
      conditions: [...query.conditions!],
    });
  };

  const onAddCondition = () => {
    onChange({
      ...query,
      conditions: [...query.conditions!, defaultCondition],
    });
  };

  const onRemoveCondition = (index: number) => {
    if (query.conditions) {
      delete query.conditions[index];
      onChange({
        ...query,
        conditions: [...query.conditions!],
      });
    }
  };

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Conditions" labelWidth={14}>
          <div>
            {query.conditions?.map((condition, index) => {
              return (
                <Condition
                  key={index}
                  index={index}
                  condition={condition}
                  onChange={(condition: ClassicCondition) => onConditionChange(condition, index)}
                  onRemoveCondition={onRemoveCondition}
                  refIds={refIds}
                />
              );
            })}
          </div>
        </InlineField>
      </InlineFieldRow>
      <Button variant="secondary" onClick={onAddCondition}>
        <Icon name="plus-circle" />
      </Button>
    </div>
  );
};
