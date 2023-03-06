import React from 'react';

import { CodeEditor, Select } from '@grafana/ui';

import { RuleType, RuleSetting, PipeLineEntitiesInfo } from './types';

interface Props {
  ruleType: RuleType;
  onChange: (value: RuleSetting) => void;
  value: RuleSetting;
  entitiesInfo: PipeLineEntitiesInfo;
}

export const RuleSettingsEditor = ({ onChange, value, ruleType, entitiesInfo }: Props) => {
  return (
    <>
      <Select
        key={ruleType}
        options={entitiesInfo[ruleType]}
        placeholder="Select an option"
        value={value?.type ?? ''}
        onChange={(value) => {
          // set the body with example
          const type = value.value;
          onChange({
            type,
            [type]: entitiesInfo.getExample(ruleType, type),
          });
        }}
      />
      <CodeEditor
        height={'50vh'}
        value={value ? JSON.stringify(value[value.type], null, '\t') : ''}
        showLineNumbers={true}
        readOnly={false}
        language="json"
        showMiniMap={false}
        onBlur={(text: string) => {
          const body = JSON.parse(text);
          onChange({
            type: value.type,
            [value.type]: body,
          });
        }}
      />
    </>
  );
};
