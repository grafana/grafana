import React from 'react';
import { FieldOverrideEditorProps } from '@grafana/data';
import {
  HorizontalGroup,
  IconButton,
  Input,
  RadioButtonGroup,
  StackingConfig,
  StackingMode,
  Tooltip,
} from '@grafana/ui';

export const StackingEditor: React.FC<FieldOverrideEditorProps<StackingConfig, any>> = ({
  value,
  context,
  onChange,
  item,
}) => {
  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value?.mode || StackingMode.None}
        options={item.settings.options}
        onChange={(v) => {
          onChange({
            ...value,
            mode: v,
          });
        }}
      />
      {context.isOverride && value?.mode && value?.mode !== StackingMode.None && (
        <Input
          type="text"
          placeholder="Group"
          suffix={
            <Tooltip content="Name of the stacking group" placement="top">
              <IconButton name="question-circle" />
            </Tooltip>
          }
          defaultValue={value?.group}
          onChange={(v) => {
            onChange({
              ...value,
              group: v.currentTarget.value.trim(),
            });
          }}
        />
      )}
    </HorizontalGroup>
  );
};
