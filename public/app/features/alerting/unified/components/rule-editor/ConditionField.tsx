import { SelectableValue } from '@grafana/data';
import { Field, InputControl, Select } from '@grafana/ui';
import { ExpressionDatasourceID } from 'app/features/expressions/ExpressionDatasource';
import React, { FC, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';

export const ConditionField: FC = () => {
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

  // reset condition if option no longer exists or if it is unset, but there are options available
  useEffect(() => {
    const expressions = queries.filter((query) => query.model.datasource === ExpressionDatasourceID);
    if (condition && !options.find(({ value }) => value === condition)) {
      setValue('condition', expressions.length ? expressions[expressions.length - 1].refId : null);
    } else if (!condition && expressions.length) {
      setValue('condition', expressions[expressions.length - 1].refId);
    }
  }, [condition, options, queries, setValue]);

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
