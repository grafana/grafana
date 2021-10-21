import React, { useCallback } from 'react';
import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';

import { LookupGazetteerOptions } from '@grafana/data/src/transformations/transformers/lookupGazetteer';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { GazetteerPathEditor } from 'app/plugins/panel/geomap/editor/GazetteerPathEditor';
import { GazetteerPathEditorConfigSettings } from 'app/plugins/panel/geomap/types';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: { width: 24 },
} as any;

const gazetteerSettings: StandardEditorsRegistryItem<string, GazetteerPathEditorConfigSettings> = {
  settings: {},
} as any;

export const LookupGazetteerTransformerEditor: React.FC<TransformerUIProps<LookupGazetteerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const onPickMappingField = useCallback(
    (value: string | undefined) => {
      onChange({
        ...options,
        mappingField: value,
      });
    },
    [onChange, options]
  );
  const onPickTargetField = useCallback(
    (value: string | undefined) => {
      onChange({
        ...options,
        lookupField: value,
      });
    },
    [onChange, options]
  );

  const onPickGazetteer = useCallback(
    (value: string | undefined) => {
      onChange({
        ...options,
        gazetteer: value,
      });
    },
    [onChange, options]
  );
  return (
    <InlineFieldRow>
      <InlineField label={'Current field'}>
        <FieldNamePicker
          context={{ data: input }}
          value={options?.lookupField ?? ''}
          onChange={onPickMappingField}
          item={fieldNamePickerSettings}
        />
      </InlineField>
      <InlineField label={'Gazetteer'}>
        <GazetteerPathEditor
          value={options?.gazetteer ?? ''}
          context={{ data: input }}
          item={gazetteerSettings}
          onChange={onPickGazetteer}
        />
      </InlineField>
      <InlineField label={'lookup field'}>
        <FieldNamePicker
          context={{ data: input }}
          value={options?.lookupField ?? ''}
          onChange={onPickTargetField}
          item={fieldNamePickerSettings}
        />
      </InlineField>
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
