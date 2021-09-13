import React, { FC, useCallback, useState } from 'react';
import { FieldNamePickerConfigSettings, StandardEditorProps, StandardEditorsRegistryItem } from '@grafana/data';
import { ResourceDimensionConfig, ResourceDimensionMode, ResourceDimensionOptions } from '../types';
import { InlineField, InlineFieldRow, RadioButtonGroup, Button, Modal, Input } from '@grafana/ui';
import { FieldNamePicker } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNamePicker';
import { ResourcePicker } from './ResourcePicker';

const resourceOptions = [
  { label: 'Fixed', value: ResourceDimensionMode.Fixed, description: 'Fixed value' },
  { label: 'Field', value: ResourceDimensionMode.Field, description: 'Use a string field result' },
  //  { label: 'Mapping', value: ResourceDimensionMode.Mapping, description: 'Map the results of a value to an svg' },
];

const dummyFieldSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {},
} as any;

export const ResourceDimensionEditor: FC<
  StandardEditorProps<ResourceDimensionConfig, ResourceDimensionOptions, any>
> = (props) => {
  const { value, context, onChange, item } = props;
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
    (fixed?: string) => {
      onChange({
        ...value,
        fixed: fixed ?? '',
      });
      setOpen(false);
    },
    [onChange, value]
  );

  const openModal = useCallback(() => {
    setOpen(true);
  }, []);

  const mode = value?.mode ?? ResourceDimensionMode.Fixed;
  const mediaType = item.settings?.resourceType ?? 'icon';

  return (
    <>
      {isOpen && (
        <Modal isOpen={isOpen} title={`Select ${mediaType}`} onDismiss={() => setOpen(false)} closeOnEscape>
          <ResourcePicker onChange={onFixedChange} value={value?.fixed} mediaType={mediaType} />
        </Modal>
      )}

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
        <InlineFieldRow>
          <InlineField label={null} grow>
            <Input value={value?.fixed} placeholder="Resource URL" readOnly={true} onClick={openModal} />
          </InlineField>
          <Button icon="folder-open" variant="secondary" onClick={openModal} />
        </InlineFieldRow>
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
