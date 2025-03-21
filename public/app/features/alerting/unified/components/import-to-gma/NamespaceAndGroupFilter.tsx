import { css } from '@emotion/css';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, Stack, VirtualizedSelect, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useGetNameSpacesByDatasourceName } from '../rule-editor/useAlertRuleSuggestions';

import { ImportFormValues } from './ImportFromDSRules';

interface Props {
  rulesSourceName: string;
}

export const NamespaceAndGroupFilter = ({ rulesSourceName }: Props) => {
  const {
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<ImportFormValues>();

  const style = useStyles2(getStyle);
  const namespace = watch('namespace');
  const { namespaceGroups, isLoading } = useGetNameSpacesByDatasourceName(rulesSourceName);

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
    <Stack direction="row" gap={2}>
      <Field
        data-testid="namespace-picker"
        label={t('alerting.import-to-gma.namespace.label', 'Namespace')}
        // Disable translations as we don't intend to use this dropdown longterm,
        // so avoiding us adding translations for the sake of it
        // eslint-disable-next-line @grafana/no-untranslated-strings
        description={t('alerting.import-to-gma.namespace.description', 'Type to search for an existing namespace')}
        error={errors.namespace?.message}
        invalid={!!errors.namespace?.message}
      >
        <Controller
          render={({ field: { onChange, ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              className={style.input}
              onChange={(value) => {
                setValue('ruleGroup', ''); //reset if namespace changes
                onChange(value.value);
              }}
              options={namespaceOptions}
              width={42}
              isLoading={isLoading}
              disabled={isLoading}
            />
          )}
          name="namespace"
          control={control}
        />
      </Field>
      <Field
        data-testid="group-picker"
        label={t('alerting.import-to-gma.group.label', 'Group')}
        // Disable translations as we don't intend to use this dropdown longterm,
        // so avoiding us adding translations for the sake of it
        // eslint-disable-next-line @grafana/no-untranslated-strings
        description={t(
          'alerting.import-to-gma.group.description',
          'Type to search for an existing group or create a new one'
        )}
        error={errors.ruleGroup?.message}
        invalid={!!errors.ruleGroup?.message}
      >
        <Controller
          render={({ field: { ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              allowCustomValue
              options={groupOptions}
              width={42}
              onChange={(value) => {
                setValue('ruleGroup', value.value ?? '');
              }}
              className={style.input}
              isLoading={isLoading}
              disabled={isLoading}
            />
          )}
          name="ruleGroup"
          control={control}
        />
      </Field>
    </Stack>
  );
};

const getStyle = (theme: GrafanaTheme2) => ({
  input: css({
    width: '330px !important',
  }),
  filterBox: css({
    display: 'flex',
    flexDirection: 'row',
    paddingLeft: theme.spacing(1),
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
});
