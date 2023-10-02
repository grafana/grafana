import React from 'react';
import { RadioButtonGroup } from 'src/components/Forms/RadioButtonGroup/RadioButtonGroup';
import { IconButton } from 'src/components/IconButton/IconButton';
import { Input } from 'src/components/Input/Input';
import { HorizontalGroup } from 'src/components/Layout/Layout';
import { graphFieldOptions } from 'src/components/uPlot/config';

import {
  FieldConfigEditorBuilder,
  FieldOverrideEditorProps,
  FieldType,
  identityOverrideProcessor,
} from '@grafana/data';
import { GraphFieldConfig, StackingConfig, StackingMode } from '@grafana/schema';

export const StackingEditor = ({ value, context, onChange, item }: FieldOverrideEditorProps<StackingConfig, any>) => {
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
          suffix={<IconButton name="question-circle" tooltip="Name of the stacking group" tooltipPlacement="top" />}
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

export function addStackingConfig(
  builder: FieldConfigEditorBuilder<GraphFieldConfig>,
  defaultConfig?: StackingConfig,
  category = ['Graph styles']
) {
  builder.addCustomEditor({
    id: 'stacking',
    path: 'stacking',
    name: 'Stack series',
    category: category,
    defaultValue: defaultConfig,
    editor: StackingEditor,
    override: StackingEditor,
    settings: {
      options: graphFieldOptions.stacking,
    },
    process: identityOverrideProcessor,
    shouldApply: (f) => f.type === FieldType.number,
  });
}
