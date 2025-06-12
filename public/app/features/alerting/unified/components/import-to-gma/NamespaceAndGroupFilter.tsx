import { useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Combobox, ComboboxOption, Field, Stack } from '@grafana/ui';

import { useGetNameSpacesByDatasourceName } from '../rule-editor/useAlertRuleSuggestions';

import { ImportFormValues } from './ImportToGMARules';

interface Props {
  rulesSourceName?: string;
}

export const NamespaceAndGroupFilter = ({ rulesSourceName }: Props) => {
  const {
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<ImportFormValues>();

  const namespace = watch('namespace');
  const { namespaceGroups, isLoading } = useGetNameSpacesByDatasourceName(rulesSourceName);

  const namespaceOptions: Array<ComboboxOption<string>> = useMemo(
    () =>
      Array.from(namespaceGroups.keys()).map((namespace) => ({
        label: namespace,
        value: namespace,
      })),
    [namespaceGroups]
  );

  const groupOptions: Array<ComboboxOption<string>> = useMemo(
    () => (namespace && namespaceGroups.get(namespace)?.map((group) => ({ label: group, value: group }))) || [],
    [namespace, namespaceGroups]
  );

  useEffect(() => {
    // Reset namespace/group if datasource changes
    setValue('namespace', '');
    setValue('ruleGroup', '');
  }, [rulesSourceName, setValue]);

  return (
    <Stack direction="row" gap={2}>
      <Field
        htmlFor="namespace-picker"
        data-testid="namespace-picker"
        label={t('alerting.import-to-gma.namespace.label', 'Namespace')}
        description={t('alerting.import-to-gma.namespace.description', 'Type to search for an existing namespace')}
        error={errors.namespace?.message}
        invalid={!!errors.namespace?.message}
      >
        <Controller
          render={({ field: { onChange, ref, ...field } }) => (
            <Combobox
              {...field}
              onChange={(value) => {
                setValue('ruleGroup', ''); //reset if namespace changes
                onChange(value?.value);
              }}
              id="namespace-picker"
              placeholder={t('alerting.namespace-and-group-filter.select-namespace', 'Select namespace')}
              options={namespaceOptions}
              width={42}
              loading={isLoading}
              disabled={isLoading || !rulesSourceName}
              isClearable
            />
          )}
          name="namespace"
          control={control}
        />
      </Field>
      <Field
        htmlFor="group-picker"
        data-testid="group-picker"
        label={t('alerting.import-to-gma.group.label', 'Group')}
        description={t('alerting.import-to-gma.group.description', 'Type to search for an existing group')}
        error={errors.ruleGroup?.message}
        invalid={!!errors.ruleGroup?.message}
      >
        <Controller
          render={({ field: { ref, ...field } }) => (
            <Combobox
              {...field}
              options={groupOptions}
              width={42}
              onChange={(value) => {
                setValue('ruleGroup', value?.value ?? '');
              }}
              id="group-picker"
              placeholder={t('alerting.namespace-and-group-filter.select-group', 'Select group')}
              loading={isLoading}
              disabled={isLoading || !namespace || !rulesSourceName}
              isClearable
            />
          )}
          name="ruleGroup"
          control={control}
        />
      </Field>
    </Stack>
  );
};
