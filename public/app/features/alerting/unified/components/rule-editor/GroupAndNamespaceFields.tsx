import { css } from '@emotion/css';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, InputControl, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { RuleFormValues } from '../../types/rule-form';

import { SelectWithAdd } from './SelectWIthAdd';
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

  const [customGroup, setCustomGroup] = useState(false);

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
            validate: {
              pathSeparator: checkForPathSeparator,
            },
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
