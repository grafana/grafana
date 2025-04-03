import { css } from '@emotion/css';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, VirtualizedSelect, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';

import { useGetNameSpacesByDatasourceName } from './useAlertRuleSuggestions';

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

  const style = useStyles2(getStyle);
  const { namespaceGroups, isLoading } = useGetNameSpacesByDatasourceName(rulesSourceName);

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
    <div className={style.flexRow}>
      <Field
        data-testid="namespace-picker"
        label="Namespace"
        // Disable translations as we don't intend to use this dropdown longterm,
        // so avoiding us adding translations for the sake of it
        // eslint-disable-next-line @grafana/no-untranslated-strings
        description="Type to search for an existing namespace or create a new one"
        error={errors.namespace?.message}
        invalid={!!errors.namespace?.message}
      >
        <Controller
          render={({ field: { onChange, ref, ...field } }) => (
            <VirtualizedSelect
              {...field}
              allowCustomValue
              className={style.input}
              onChange={(value) => {
                setValue('group', ''); //reset if namespace changes
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
          rules={{
            required: { value: true, message: 'Required.' },
          }}
        />
      </Field>
      <Field
        data-testid="group-picker"
        label="Group"
        // Disable translations as we don't intend to use this dropdown longterm,
        // so avoiding us adding translations for the sake of it
        // eslint-disable-next-line @grafana/no-untranslated-strings
        description="Type to search for an existing group or create a new one"
        error={errors.group?.message}
        invalid={!!errors.group?.message}
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
              className={style.input}
              isLoading={isLoading}
              disabled={isLoading}
            />
          )}
          name="group"
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
          }}
        />
      </Field>
    </div>
  );
};

const getStyle = (theme: GrafanaTheme2) => ({
  flexRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',

    '& > * + *': {
      marginLeft: theme.spacing(3),
    },
  }),
  input: css({
    width: '330px !important',
  }),
});
