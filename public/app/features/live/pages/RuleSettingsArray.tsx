import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { RuleSettingsEditor } from './RuleSettingsEditor';
import { RuleType, RuleSetting, PipeLineEntitiesInfo } from './types';

interface Props {
  ruleType: RuleType;
  onChange: (value: RuleSetting[]) => void;
  value: RuleSetting[];
  entitiesInfo: PipeLineEntitiesInfo;
}

export const RuleSettingsArray = ({ onChange, value, ruleType, entitiesInfo }: Props) => {
  const [index, setIndex] = useState<number>(0);
  const arr = value ?? [];
  const onRuleChange = (v: RuleSetting) => {
    if (!value) {
      onChange([v]);
    } else {
      const copy = [...value];
      copy[index] = v;
      onChange(copy);
    }
  };
  // create array of value.length + 1
  let indexArr: Array<SelectableValue<number>> = [];
  for (let i = 0; i <= arr.length; i++) {
    indexArr.push({
      label: `${ruleType}: ${i}`,
      value: i,
    });
  }

  return (
    <>
      <Select
        placeholder="Select an index"
        options={indexArr}
        value={index}
        onChange={(index) => {
          // set index to find the correct setting
          setIndex(index.value!);
        }}
      ></Select>
      <RuleSettingsEditor onChange={onRuleChange} value={arr[index]} ruleType={ruleType} entitiesInfo={entitiesInfo} />
    </>
  );
};
