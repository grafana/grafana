import React, { useState, useEffect } from 'react';
import { CodeEditor, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Rule } from './types';

interface Props {
  rule: Rule;
  types: Array<SelectableValue<string>>;
  onBlur: (text, setting, settingType) => void;
  setting: 'converter' | 'processor' | 'output';
  pipelineEntitiesList: [];
}
interface PipelineListOption {
  type: string;
  description: string;
  example: object;
}
const height = 600;

const SettingsEditor: React.FC<Props> = ({ rule, onBlur, types, setting, pipelineEntitiesList }) => {
  const settingBody = rule.settings[setting];
  let type = settingBody?.type;
  let settingValue = {};
  const [settingType, setSettingType] = useState<string | undefined>(type);

  useEffect(() => {
    setSettingType(type);
  }, [type]);
  // get the example body of the type out
  const example = pipelineEntitiesList?.filter((option: PipelineListOption) => option.type === settingType)?.[0]?.[
    'example'
  ];

  if (settingBody && type) {
    settingValue = settingType === type ? settingBody[type] : example;
    console.log(settingValue);
  }

  return (
    <>
      <Select
        options={types}
        value={settingType}
        onChange={(value) => {
          setSettingType(value.value);
        }}
      />
      <CodeEditor
        height={height}
        value={settingValue ? JSON.stringify(settingValue, null, '\t') : ''}
        showLineNumbers={true}
        readOnly={false}
        language="json"
        showMiniMap={false}
        onBlur={(text) => onBlur(text, setting, settingType)}
      />
    </>
  );
};

export default SettingsEditor;
