import React from 'react';
import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

import { LookupGazetteerOptions } from '@grafana/data/src/transformations/transformers/lookupGazetteer';
import { InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { width: 24 },
} as any;

export const LookupGazetteerTransformerEditor: React.FC<TransformerUIProps<LookupGazetteerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const onPickField = React.useCallback(
    (value: string | undefined) => {
      onChange({
        ...options,
        lookupField: value,
      });
    },
    [onChange, options]
  );
  return (
    <InlineFieldRow>
      <InlineFieldRow label={'Field'}>
        <FieldNamePicker
          context={{ data: input }}
          value={options.lookupField ?? ''}
          onChange={onPickField}
          item={fieldNamePickerSettings}
        />
      </InlineFieldRow>
    </InlineFieldRow>
  );
};

export const lookupGazetteerTransformRegistryItem: TransformerRegistryItem<LookupGazetteerOptions> = {
  id: DataTransformerID.lookupGazetteer,
  editor: LookupGazetteerTransformerEditor,
  transformation: standardTransformers.lookupGazetteerTransformer,
  name: 'Lookup gazetteer',
  description: `Looks up matching data from gazetteer based on selected field`,
};
