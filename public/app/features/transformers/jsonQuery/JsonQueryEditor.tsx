import React, { useState } from 'react';

import {
  DataTransformerID,
  FieldType,
  FieldNamePickerConfigSettings,
  SelectableValue,
  StandardEditorsRegistryItem,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select, InlineSwitch, Button } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { jsonQueryTransformer } from './jsonQuery';
import { JSONQueryOptions } from './types';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {
    width: 30,
    placeholderText: 'Select field',
  },
  name: '',
  id: '',
  editor: () => null,
};

export const JsonQueryTransformerEditor: React.FC<TransformerUIProps<JSONQueryOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const [query, setQuery] = useState<string>(options.query ?? '$');
  const [queryOnChange, SetQueryOnChange] = useState<boolean>(false);

  const onToggleQueryOnChange = () => {
    SetQueryOnChange(!queryOnChange);
  };

  const onPickSourceField = (source?: string) => {
    onChange({
      ...options,
      source,
    });
  };

  const onChangeQuery = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (queryOnChange) {
      onChange({
        ...options,
        query: event.currentTarget.value,
      });
    } else {
      setQuery(event.currentTarget.value);
    }
  };

  const onClickQuery = () => {
    onChange({
      ...options,
      query,
    });
  };

  const onChangeType = (type: SelectableValue<FieldType>) => {
    onChange({
      ...options,
      type: type.value,
    });
  };

  const onAliasChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      alias: event.currentTarget.value,
    });
  };

  return (
    <div>
      <InlineFieldRow>
        <InlineField label={'Query on change'} labelWidth={16}>
          <InlineSwitch value={queryOnChange} onChange={onToggleQueryOnChange} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Source'} labelWidth={16}>
          <FieldNamePicker
            context={{ data: input }}
            value={options.source ?? ''}
            onChange={onPickSourceField}
            item={fieldNamePickerSettings}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Field"
          tooltip={
            <div>
              A <a href="https://goessner.net/articles/JsonPath/">JSON Path</a> query that selects one or more values
              from a JSON object.
            </div>
          }
          grow
        >
          <Input onChange={onChangeQuery} value={queryOnChange ? options.query ?? '$' : query} />
        </InlineField>
        <InlineField label="Type" tooltip="If Auto is set, the JSON property type is used to detect the field type.">
          <Select
            value={options.type ?? FieldType.other}
            width={12}
            onChange={onChangeType}
            options={[
              { label: 'Auto', value: FieldType.other },
              { label: 'String', value: FieldType.string },
              { label: 'Number', value: FieldType.number },
              { label: 'Time', value: FieldType.time },
              { label: 'Boolean', value: FieldType.boolean },
            ]}
          />
        </InlineField>
        <InlineField label="Alias" tooltip="If left blank, the field uses the name of the queried element.">
          <Input width={12} value={options.alias ?? ''} onChange={onAliasChange} />
        </InlineField>
      </InlineFieldRow>
      {!queryOnChange && (
        <InlineFieldRow>
          <Button onClick={onClickQuery} size="md" variant={'secondary'}>
            Query
          </Button>
        </InlineFieldRow>
      )}
    </div>
  );
};

export const jsonQueryTransformRegistryItem: TransformerRegistryItem<JSONQueryOptions> = {
  id: DataTransformerID.jsonQuery,
  editor: JsonQueryTransformerEditor,
  transformation: jsonQueryTransformer,
  name: 'Query JSON',
  description: 'Query JSON for specific values.',
};
