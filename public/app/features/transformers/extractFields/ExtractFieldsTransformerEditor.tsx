import React, { useState } from 'react';

import { DataTransformerID, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, Button } from '@grafana/ui';

import { Collapsable } from './components/Collapsable';
import { SourceFieldEditor } from './components/SourceFieldEditor';
import { extractFieldsTransformer } from './extractFields';
import { ExtractFieldsOptions, FieldExtractorID, SourceField } from './types';

export const ExtractFieldsTransformerEditor: React.FC<TransformerUIProps<ExtractFieldsOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const [sources, setSources] = useState<SourceField[]>(options.sources ?? []);

  const addSourceField = () => {
    sources.push({ source: '', jsonPaths: [], format: FieldExtractorID.Auto });
    setSources([...sources]);
    onChange({
      ...options,
      sources,
    });
  };

  const onSourceFieldChange = (sourceField: SourceField, key: number) => {
    if (sources) {
      sources[key] = sourceField;
      setSources([...sources]);
      onChange({
        ...options,
        sources,
      });
    }
  };

  const removeSourceField = (key: number) => {
    sources.splice(key, 1);
    setSources([...sources]);
    onChange({
      ...options,
      sources,
    });
  };

  const onToggleReplace = () => {
    onChange({
      ...options,
      replace: !options.replace,
    });
  };

  const onToggleKeepTime = () => {
    onChange({
      ...options,
      keepTime: !options.keepTime,
    });
  };

  return (
    <div>
      {!!sources.length &&
        sources.map((source: SourceField, key: number) => (
          <Collapsable
            label={source.source && source.source.length ? source.source : 'NewSource'}
            isOpen={true}
            key={key}
            onRemove={() => removeSourceField(key)}
          >
            <SourceFieldEditor
              input={input}
              options={source}
              onChange={(sourceField) => onSourceFieldChange(sourceField, key)}
            />
          </Collapsable>
        ))}
      <InlineField>
        <Button onClick={addSourceField} size="md" variant={'secondary'} icon={'plus'}>
          Add Source
        </Button>
      </InlineField>
      <InlineFieldRow>
        <InlineField label={'Replace all fields'} labelWidth={16}>
          <InlineSwitch value={options.replace ?? false} onChange={onToggleReplace} />
        </InlineField>
      </InlineFieldRow>
      {options.replace && (
        <InlineFieldRow>
          <InlineField label={'Keep Time'} labelWidth={16}>
            <InlineSwitch value={options.keepTime ?? false} onChange={onToggleKeepTime} />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
};

export const extractFieldsTransformRegistryItem: TransformerRegistryItem<ExtractFieldsOptions> = {
  id: DataTransformerID.extractFields,
  editor: ExtractFieldsTransformerEditor,
  transformation: extractFieldsTransformer,
  name: 'Extract fields',
  description: `Parse fields from content (JSON, labels, etc)`,
};
