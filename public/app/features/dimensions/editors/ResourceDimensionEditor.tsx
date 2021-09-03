import React, { FC, useCallback, useState } from 'react';
import { FieldNamePickerConfigSettings, StandardEditorProps, StandardEditorsRegistryItem } from '@grafana/data';
import { ResourceDimensionConfig, ResourceDimensionMode, ResourceDimensionOptions } from '../types';
import { InlineField, InlineFieldRow, RadioButtonGroup, Button, Modal } from '@grafana/ui';
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
    (fixed: string) => {
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
        <div
          style={{
            display: 'inline-block',
          }}
        >
          <span
            style={{
              marginRight: value?.fixed ? '5px' : '0',
            }}
          >
            {value?.fixed}
          </span>
          <Button variant="secondary" size="sm" fullWidth onClick={() => setOpen(true)}>
            {value?.fixed ? `Edit ${item.settings?.resourceType}` : `Add ${item.settings?.resourceType}`}
          </Button>
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
