import { css } from '@emotion/css';
import React, { FC, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, InputControl, useStyles2, VirtualizedSelect } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { RuleFormValues } from '../../types/rule-form';

import { checkForPathSeparator } from './util';

interface Props {
  rulesSourceName: string;
}

export const GroupAndNamespaceFields: FC<Props> = ({ rulesSourceName }) => {
  const {
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const style = useStyles2(getStyle);

  const rulerRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchRulerRulesAction({ rulesSourceName }));
  }, [rulesSourceName, dispatch]);

  const rulesConfig = rulerRequests[rulesSourceName]?.result;

  const namespace = watch('namespace');

  const namespaceOptions = useMemo(
    (): Array<SelectableValue<string>> =>
      rulesConfig ? Object.keys(rulesConfig).map((namespace) => ({ label: namespace, value: namespace })) : [],
    [rulesConfig]
  );

  const groupOptions = useMemo(
    (): Array<SelectableValue<string>> =>
      (namespace && rulesConfig?.[namespace]?.map((group) => ({ label: group.name, value: group.name }))) || [],
    [namespace, rulesConfig]
  );

  return (
    <div className={style.flexRow}>
      <Field
        data-testid="namespace-picker"
        label="Namespace"
        error={errors.namespace?.message}
        invalid={!!errors.namespace?.message}
      >
        <InputControl
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
            />
          )}
          name="namespace"
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
            validate: {
              pathSeparator: checkForPathSeparator,
            },
          }}
        />
      </Field>
      <Field data-testid="group-picker" label="Group" error={errors.group?.message} invalid={!!errors.group?.message}>
        <InputControl
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
            />
          )}
          name="group"
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
            validate: {
              pathSeparator: checkForPathSeparator,
            },
          }}
        />
      </Field>
    </div>
  );
};

const getStyle = (theme: GrafanaTheme2) => ({
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;

    & > * + * {
      margin-left: ${theme.spacing(3)};
    }
  `,
  input: css`
    width: 330px !important;
  `,
});
