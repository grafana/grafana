import React, { useState } from 'react';

import { FieldNamePickerConfigSettings, SelectableValue, StandardEditorsRegistryItem, DataFrame } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { fieldExtractors } from '../fieldExtractors';
import { SourceField, JSONPath, FieldExtractorID } from '../types';

import { JSONPathEditor } from './JSONPathEditor';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {
    width: 30,
    placeholderText: 'Select field',
  },
  name: '',
  id: '',
  editor: () => null,
};

interface Props {
  input: DataFrame[];
  options: SourceField;
  onChange: (options: SourceField) => void;
}

export function SourceFieldEditor({ input, options, onChange }: Props) {
  const [sourceField, setSourceField] = useState<SourceField>(options);

  const onPickSourceField = (source?: string) => {
    sourceField.source = source;
    setSourceField({ ...sourceField });
    onChange(sourceField);
  };

  const onFormatChange = (select?: SelectableValue<FieldExtractorID>) => {
    sourceField.format = select?.value;
    setSourceField({ ...sourceField });
    onChange(sourceField);
  };

  const onJSONPathsChange = (paths: JSONPath[]) => {
    sourceField.jsonPaths = paths;
    setSourceField({ ...sourceField });
    onChange(sourceField);
  };

  const format = fieldExtractors.selectOptions(sourceField.format ? [sourceField.format] : undefined);

  return (
    <div>
      <InlineFieldRow>
        <InlineField label={'Source'} labelWidth={16}>
          <FieldNamePicker
            context={{ data: input }}
            value={sourceField.source ?? ''}
            onChange={onPickSourceField}
            item={fieldNamePickerSettings as any}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Format'} labelWidth={16}>
          <Select
            value={format.current[0] as any}
            options={format.options as any}
            onChange={onFormatChange}
            width={24}
            placeholder={'Auto'}
          />
        </InlineField>
      </InlineFieldRow>
      {sourceField.format === 'json' && (
        <JSONPathEditor options={sourceField.jsonPaths ?? []} onChange={onJSONPathsChange} />
      )}
    </div>
  );
}
