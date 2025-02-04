import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Field, Stack, VirtualizedSelect } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';

import { useAlertRuleSuggestions } from './useAlertRuleSuggestions';

interface Props {
  rulesSourceName: string;
}

export const GroupAndNamespaceFields = ({ rulesSourceName }: Props) => {
  const {
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const { namespaceGroups, isLoading } = useAlertRuleSuggestions(rulesSourceName);

  const namespace = watch('namespace');

  const namespaceOptions: Array<SelectableValue<string>> = useMemo(
    () =>
      Array.from(namespaceGroups.keys()).map((namespace) => ({
        label: namespace,
        value: namespace,
      })),
    [namespaceGroups]
  );

  const groupOptions: Array<SelectableValue<string>> = useMemo(
    () => (namespace && namespaceGroups.get(namespace)?.map((group) => ({ label: group, value: group }))) || [],
    [namespace, namespaceGroups]
  );

  return (
    <Stack direction="row" gap={0.5}>
      <Field
        data-testid="namespace-picker"
        label="Namespace"
        error={errors.namespace?.message}
        invalid={!!errors.namespace?.message}
        style={{ marginBottom: 0 }}
      >
        <Controller
          render={({ field: { onChange, ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              allowCustomValue
              onChange={(value) => {
                setValue('group', ''); //reset if namespace changes
                onChange(value.value);
              }}
              options={namespaceOptions}
              width={42}
              isLoading={isLoading}
              disabled={isLoading}
              placeholder="Choose namespace"
            />
          )}
          name="namespace"
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
          }}
        />
      </Field>
      <Field
        data-testid="group-picker"
        label="Group"
        error={errors.group?.message}
        invalid={!!errors.group?.message}
        style={{ marginBottom: 0 }}
      >
        <Controller
          render={({ field: { ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              allowCustomValue
              options={groupOptions}
              width={42}
              onChange={(value) => {
                setValue('group', value.value ?? '');
              }}
              isLoading={isLoading}
              disabled={isLoading}
              placeholder="Choose group"
            />
          )}
          name="group"
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
          }}
        />
      </Field>
    </Stack>
  );
};
