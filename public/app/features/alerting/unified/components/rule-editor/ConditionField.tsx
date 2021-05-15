import { SelectableValue } from '@grafana/data';
import { Field, InputControl, Select } from '@grafana/ui';
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

  // if option no longer exists, reset it
  useEffect(() => {
    if (condition && !options.find(({ value }) => value === condition)) {
      setValue('condition', null);
    }
  }, [condition, options, setValue]);

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
