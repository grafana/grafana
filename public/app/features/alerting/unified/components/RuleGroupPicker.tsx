import { Cascader, CascaderOption } from '@grafana/ui';
import React, { FC, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../state/actions';

interface RuleGroupValue {
  namespace: string;
  group: string;
}

interface Props {
  value?: RuleGroupValue;
  onChange: (value: RuleGroupValue) => void;
  dataSourceName: string;
}

const stringifyValue = ({ namespace, group }: RuleGroupValue) => namespace + '|||' + group;
const parseValue = (value: string): RuleGroupValue => {
  const [namespace, group] = value.split('|||');
  return { namespace, group };
};

export const RuleGroupPicker: FC<Props> = ({ value, onChange, dataSourceName }) => {
  const rulerRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchRulerRulesAction(dataSourceName));
  }, [dataSourceName, dispatch]);

  const rulesConfig = rulerRequests[dataSourceName]?.result;

  const options = useMemo((): CascaderOption[] => {
    if (rulesConfig) {
      return Object.entries(rulesConfig).map(([namespace, group]) => {
        return {
          label: namespace,
          value: namespace,
          items: group.map(({ name }) => {
            return { label: name, value: stringifyValue({ namespace, group: name }) };
          }),
        };
      });
    }
    return [];
  }, [rulesConfig]);

  return (
    <Cascader
      placeholder="Select a rule group"
      onSelect={(value) => {
        console.log('selected', value);
        onChange(parseValue(value));
      }}
      initialValue={value ? stringifyValue(value) : undefined}
      displayAllSelectedLevels={true}
      separator=" > "
      options={options}
      changeOnSelect={false}
    />
  );
};
