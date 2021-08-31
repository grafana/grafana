import React, { FC, useCallback, useState } from 'react';
import {
  FieldNamePickerConfigSettings,
  StandardEditorProps,
  StandardEditorsRegistryItem,
  StringFieldConfigSettings,
} from '@grafana/data';
import { ResourceDimensionConfig, ResourceDimensionMode, ResourceDimensionOptions } from '../types';
import { InlineField, InlineFieldRow, RadioButtonGroup, StringValueEditor, Button, Modal } from '@grafana/ui';
import { FieldNamePicker } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNamePicker';
import ResourcePicker from 'app/plugins/panel/canvas/editor/ResourcePicker';

const resourceOptions = [
  { label: 'Fixed', value: ResourceDimensionMode.Fixed, description: 'Fixed value' },
  { label: 'Field', value: ResourceDimensionMode.Field, description: 'Use a string field result' },
  //  { label: 'Mapping', value: ResourceDimensionMode.Mapping, description: 'Map the results of a value to an svg' },
];

const dummyFieldSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {},
} as any;

const dummyImageStringSettings: StandardEditorsRegistryItem<string, StringFieldConfigSettings> = {
  settings: {
    placeholder: 'Enter image URL',
  },
} as any;

export const ResourceDimensionEditor: FC<
  StandardEditorProps<ResourceDimensionConfig, ResourceDimensionOptions, any>
> = (props) => {
  const { value, context, onChange, item } = props;
  const resourceType = item.settings?.resourceType ?? 'icon';
  const labelWidth = 9;
  const [isOpen, setOpen] = useState(false);

  const onModeChange = useCallback(
    (mode) => {
      onChange({
        ...value,
        mode,
      });
    },
    [onChange, value]
  );

  const onFieldChange = useCallback(
    (field) => {
      onChange({
        ...value,
        field,
      });
    },
    [onChange, value]
  );
  const onFixedChange = useCallback(
    (fixed: string) => {
      // TODO: validate if the returned url is in our public folder
      onChange({
        ...value,
        fixed,
      });
      setOpen(false);
    },
    [onChange, value]
  );

  const mode = value?.mode ?? ResourceDimensionMode.Fixed;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Source" labelWidth={labelWidth} grow={true}>
          <RadioButtonGroup value={mode} options={resourceOptions} onChange={onModeChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
      {mode !== ResourceDimensionMode.Fixed && (
        <InlineFieldRow>
          <InlineField label="Field" labelWidth={labelWidth} grow={true}>
            <FieldNamePicker
              context={context}
              value={value.field ?? ''}
              onChange={onFieldChange}
              item={dummyFieldSettings}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {mode === ResourceDimensionMode.Fixed && (
        <div>
          <Button onClick={() => setOpen(true)}>Select Item</Button>
          {isOpen && (
            <Modal isOpen={isOpen} title="Select Item" onDismiss={() => setOpen(false)} closeOnEscape>
              <ResourcePicker
                onChange={onFixedChange}
                value={value?.fixed ?? 'img/bg/p0.png'}
                mediaType={item.settings?.resourceType ?? 'icon'}
              />
            </Modal>
          )}
        </div>
      )}
      {mode === ResourceDimensionMode.Mapping && (
        <InlineFieldRow>
          <InlineField label="Mappings" labelWidth={labelWidth} grow={true}>
            <div>TODO mappings editor!</div>
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};
