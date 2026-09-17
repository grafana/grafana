import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, InlineField, InlineFieldRow } from '@grafana/ui';

import { type ClassicCondition, type ClassicExpressionQuery, defaultClassicCondition } from '../schemas/classic';

import { Condition } from './Condition';

interface Props {
  query: ClassicExpressionQuery;
  refIds: Array<SelectableValue<string>>;
  onChange: (query: ClassicExpressionQuery) => void;
}

export const ClassicConditions = ({ onChange, query, refIds }: Props) => {
  const onConditionChange = (condition: ClassicCondition, index: number) => {
    onChange({
      ...query,
      conditions: [...query.conditions.slice(0, index), condition, ...query.conditions.slice(index + 1)],
    });
  };

  const onAddCondition = () => {
    const lastParams = query.conditions.at(-1)?.query.params ?? [];
    const newCondition: ClassicCondition = { ...defaultClassicCondition, query: { params: lastParams } };

    onChange({ ...query, conditions: [...query.conditions, newCondition] });
  };

  const onRemoveCondition = (index: number) => {
    const conditions = query.conditions
      .filter((_, i) => i !== index)
      .map((condition, i) => {
        if (i === 0) {
          // The first condition has no operator - the row is labelled "WHEN" - and the backend
          // ignores whatever is there. Drop it rather than leaving a stale and/or behind.
          const { operator, ...withoutOperator } = condition;
          return withoutOperator;
        }
        return condition;
      });

    onChange({ ...query, conditions });
  };

  return (
    <div>
      <InlineFieldRow>
        <InlineField label={t('expressions.classic-conditions.label-conditions', 'Conditions')} labelWidth={14}>
          <div>
            {query.conditions.map((condition, index) => {
              if (!condition) {
                return;
              }
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
      <Button variant="secondary" type="button" onClick={onAddCondition}>
        <Icon name="plus-circle" />
      </Button>
    </div>
  );
};
