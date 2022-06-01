import { last } from 'lodash';
import React, { FC, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Field, InputControl, Select } from '@grafana/ui';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';

import { RuleFormValues } from '../../types/rule-form';

interface Props {
  existing?: boolean;
}

export const ConditionField: FC<Props> = ({ existing = false }) => {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const queries = watch('queries');
  const condition = watch('condition');

  const options = useMemo(
    (): SelectableValue[] =>
      queries
        .filter((q) => !!q.refId)
        .map((q) => ({
          value: q.refId,
          label: q.refId,
        })),
    [queries]
  );

  const expressions = useMemo(() => {
    return queries.filter((query) => query.datasourceUid === ExpressionDatasourceUID);
  }, [queries]);

  // automatically use the last expression when new expressions have been added
  useEffect(() => {
    const lastExpression = last(expressions);
    if (lastExpression && !existing) {
      setValue('condition', lastExpression.refId, { shouldValidate: true });
    }
  }, [expressions, setValue, existing]);

  // reset condition if option no longer exists or if it is unset, but there are options available
  useEffect(() => {
    const lastExpression = last(expressions);
    const conditionExists = options.find(({ value }) => value === condition);

    if (condition && !conditionExists) {
      setValue('condition', lastExpression?.refId ?? null);
    } else if (!condition && lastExpression) {
      setValue('condition', lastExpression.refId, { shouldValidate: true });
    }
  }, [condition, expressions, options, setValue]);

  return (
    <Field
      label="Condition"
      description="The query or expression that will be alerted on"
      error={errors.condition?.message}
      invalid={!!errors.condition?.message}
    >
      <InputControl
        name="condition"
        render={({ field: { onChange, ref, ...field } }) => (
          <Select
            menuShouldPortal
            aria-label="Condition"
            {...field}
            width={42}
            options={options}
            onChange={(v: SelectableValue) => onChange(v?.value ?? null)}
            noOptionsMessage="No queries defined"
          />
        )}
        rules={{
          required: {
            value: true,
            message: 'Please select the condition to alert on',
          },
        }}
      />
    </Field>
  );
};
