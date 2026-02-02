import { useCallback } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import {
  SanitizeFieldOptions,
  SanitizeFieldTransformerOptions,
} from '@grafana/data/src/transformations/transformers/sanitizeField';
import { Button, InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { width: 24, isClearable: false },
} as any;

export const SanitizeTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<SanitizeFieldTransformerOptions>) => {
  const onSelectField = useCallback(
    (idx: number) => (value: string | undefined) => {
      const sanitizers = options.sanitizers;
      sanitizers[idx] = { ...sanitizers[idx], targetField: value ?? '' };
      onChange({
        ...options,
        sanitizers: sanitizers,
      });
    },
    [onChange, options]
  );

  const onAddSanitizeField = useCallback(() => {
    onChange({
      ...options,
      sanitizers: [...options.sanitizers, { targetField: undefined }],
    });
  }, [onChange, options]);

  const onRemoveSanitizeField = useCallback(
    (idx: number) => {
      const removed = options.sanitizers;
      removed.splice(idx, 1);
      onChange({
        ...options,
        sanitizers: removed,
      });
    },
    [onChange, options]
  );

  return (
    <>
      {options.sanitizers.map((c: SanitizeFieldOptions, idx: number) => {
        return (
          <div key={`${c.targetField}-${idx}`}>
            <InlineFieldRow>
              <InlineField label={'Field'}>
                <FieldNamePicker
                  context={{ data: input }}
                  value={c.targetField ?? ''}
                  onChange={onSelectField(idx)}
                  item={fieldNamePickerSettings}
                />
              </InlineField>
              <Button
                size="md"
                icon="trash-alt"
                variant="secondary"
                onClick={() => onRemoveSanitizeField(idx)}
                aria-label={'Remove sanitize field type transformer'}
              />
            </InlineFieldRow>
          </div>
        );
      })}
      <Button
        size="sm"
        icon="plus"
        onClick={onAddSanitizeField}
        variant="secondary"
        aria-label={'Add a field to sanitize'}
      >
        {'Add field'}
      </Button>
    </>
  );
};

export const sanitizeFieldTransformRegistryItem: TransformerRegistryItem<SanitizeFieldTransformerOptions> = {
  id: DataTransformerID.sanitizeFunctions,
  editor: SanitizeTransformerEditor,
  transformation: standardTransformers.sanitizeFieldTransformer,
  name: standardTransformers.sanitizeFieldTransformer.name,
  description: standardTransformers.sanitizeFieldTransformer.description,
};
