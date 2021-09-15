import React, { FC, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { RuleFormValues } from '../../types/rule-form';
import { useFormContext } from 'react-hook-form';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SelectWithAdd } from './SelectWIthAdd';
import { Field, InputControl, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  dataSourceName: string;
}

export const GroupAndNamespaceFields: FC<Props> = ({ dataSourceName }) => {
  const {
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const style = useStyles2(getStyle);

  const [customGroup, setCustomGroup] = useState(false);

  const rulerRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchRulerRulesAction(dataSourceName));
  }, [dataSourceName, dispatch]);

  const rulesConfig = rulerRequests[dataSourceName]?.result;

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
            <SelectWithAdd
              {...field}
              className={style.input}
              onChange={(value) => {
                setValue('group', ''); //reset if namespace changes
                onChange(value);
              }}
              onCustomChange={(custom: boolean) => {
                custom && setCustomGroup(true);
              }}
              options={namespaceOptions}
              width={42}
            />
          )}
          name="namespace"
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
          }}
        />
      </Field>
      <Field data-testid="group-picker" label="Group" error={errors.group?.message} invalid={!!errors.group?.message}>
        <InputControl
          render={({ field: { ref, ...field } }) => (
            <SelectWithAdd {...field} options={groupOptions} width={42} custom={customGroup} className={style.input} />
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
