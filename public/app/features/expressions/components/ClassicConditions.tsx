import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { Button, Icon, InlineField, InlineFieldRow } from '@grafana/ui';
import { Condition } from './Condition';
import { ClassicCondition, ExpressionQuery } from '../types';

interface Props {
  query: ExpressionQuery;
  refIds: Array<SelectableValue<string>>;
  onAddCondition: () => void;
  onRemoveCondition: (id: number) => void;
  onChange: (query: ExpressionQuery) => void;
}

export const ClassicConditions: FC<Props> = ({ onAddCondition, onRemoveCondition, onChange, query, refIds }) => {
  const onConditionChange = (condition: ClassicCondition, index: number) => {
    query.conditions![index] = condition;
    onChange({
      ...query,
      conditions: [...query.conditions!],
    });
  };

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Conditions">
          <div>
            {query.conditions?.map((condition, index) => {
              return (
                <Condition
                  key={index}
                  condition={condition}
                  index={index}
                  onChange={onConditionChange}
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
