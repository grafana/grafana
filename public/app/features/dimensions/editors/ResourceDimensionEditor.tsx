import { useCallback } from 'react';
import * as React from 'react';

import { FieldNamePickerConfigSettings, StandardEditorProps, StandardEditorsRegistryItem } from '@grafana/data';
import { ResourceDimensionConfig, ResourceDimensionMode } from '@grafana/schema';
import { InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { getPublicOrAbsoluteUrl, ResourceFolderName } from '..';
import { MediaType, ResourceDimensionOptions, ResourcePickerSize } from '../types';

import { ResourcePicker } from './ResourcePicker';

const resourceOptions = [
  { label: 'Fixed', value: ResourceDimensionMode.Fixed, description: 'Fixed value' },
  { label: 'Field', value: ResourceDimensionMode.Field, description: 'Use a string field result' },
  //  { label: 'Mapping', value: ResourceDimensionMode.Mapping, description: 'Map the results of a value to an svg' },
];

const dummyFieldSettings = {
  settings: {},
} as StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings>;

export const ResourceDimensionEditor = (
  props: StandardEditorProps<ResourceDimensionConfig, ResourceDimensionOptions, unknown>
) => {
  const { value, context, onChange, item } = props;
  const labelWidth = 9;

  const onModeChange = useCallback(
    (mode: ResourceDimensionMode) => {
      onChange({
        ...value,
        mode,
      });
    },
    [onChange, value]
  );

  const onFieldChange = useCallback(
    (field = '') => {
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
    },
    [onChange, value]
  );

  const onClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange({ mode: ResourceDimensionMode.Fixed, fixed: '', field: '' });
  };

  const mode = value?.mode ?? ResourceDimensionMode.Fixed;
  const showSourceRadio = item.settings?.showSourceRadio ?? true;
  const mediaType = item.settings?.resourceType ?? MediaType.Icon;
  const folderName = item.settings?.folderName ?? ResourceFolderName.Icon;
  const maxFiles = item.settings?.maxFiles; // undefined leads to backend default
  let srcPath = '';
  if (mediaType === MediaType.Icon) {
    if (value?.fixed) {
      srcPath = getPublicOrAbsoluteUrl(value.fixed);
    } else if (item.settings?.placeholderValue) {
      srcPath = getPublicOrAbsoluteUrl(item.settings.placeholderValue);
    }
  }

  return (
    <>
      {showSourceRadio && (
        <InlineFieldRow>
          <InlineField label="Source" labelWidth={labelWidth} grow={true}>
            <RadioButtonGroup value={mode} options={resourceOptions} onChange={onModeChange} fullWidth />
          </InlineField>
        </InlineFieldRow>
      )}
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
        <ResourcePicker
          onChange={onFixedChange}
          onClear={onClear}
          value={value?.fixed}
          src={srcPath}
          placeholder={item.settings?.placeholderText ?? 'Select a value'}
          name={niceName(value?.fixed) ?? ''}
          mediaType={mediaType}
          folderName={folderName}
          size={ResourcePickerSize.NORMAL}
          maxFiles={maxFiles}
        />
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

export function niceName(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const idx = value.lastIndexOf('/');
  if (idx > 0) {
    return value.substring(idx + 1);
  }
  return value;
}
