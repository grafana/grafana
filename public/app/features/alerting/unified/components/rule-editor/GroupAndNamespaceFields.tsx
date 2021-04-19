import React, { FC, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { RuleFormValues } from '../../types/rule-form';
import { useFormContext } from 'react-hook-form';
import { SelectableValue } from '@grafana/data';
import { SelectWithAdd } from './SelectWIthAdd';
import { Field, InputControl } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  dataSourceName: string;
}

export const GroupAndNamespaceFields: FC<Props> = ({ dataSourceName }) => {
  const { control, watch, errors, setValue } = useFormContext<RuleFormValues>();

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
    <>
      <Field label="Namespace" error={errors.namespace?.message} invalid={!!errors.namespace?.message}>
        <InputControl
          as={SelectWithAdd}
          className={inputStyle}
          name="namespace"
          options={namespaceOptions}
          control={control}
          width={42}
          rules={{
            required: { value: true, message: 'Required.' },
          }}
          onChange={(values) => {
            setValue('group', ''); //reset if namespace changes
            return values[0];
          }}
          onCustomChange={(custom: boolean) => {
            custom && setCustomGroup(true);
          }}
        />
      </Field>
      <Field label="Group" error={errors.group?.message} invalid={!!errors.group?.message}>
        <InputControl
          as={SelectWithAdd}
          name="group"
          className={inputStyle}
          options={groupOptions}
          width={42}
          custom={customGroup}
          control={control}
          rules={{
            required: { value: true, message: 'Required.' },
          }}
        />
      </Field>
    </>
  );
};

const inputStyle = css`
  width: 330px;
`;
