import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Field, SliderValueEditor } from '@grafana/ui';

import { ColorDimensionEditor, ResourceDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';
import {
  ScaleDimensionConfig,
  ResourceDimensionConfig,
  ColorDimensionConfig,
  ResourceFolderName,
} from 'app/features/dimensions/types';
import { defaultStyleConfig, StyleConfig } from '../../style/types';

export const StyleEditor: FC<StandardEditorProps<StyleConfig, any, any>> = ({ value, context, onChange }) => {
  const onSizeChange = (sizeValue: ScaleDimensionConfig | undefined) => {
    onChange({ ...value, size: sizeValue });
  };

  const onResourceChange = (resourceValue: ResourceDimensionConfig | undefined) => {
    onChange({ ...value, symbol: resourceValue });
  };

  const onColorChange = (colorValue: ColorDimensionConfig | undefined) => {
    onChange({ ...value, color: colorValue });
  };

  const onOpacityChange = (opacityValue: number | undefined) => {
    onChange({ ...value, opacity: opacityValue });
  };

  return (
    <>
      <Field label={'Marker Size'}>
        <ScaleDimensionEditor
          value={value.size ?? defaultStyleConfig.size}
          context={context}
          onChange={onSizeChange}
          item={
            {
              settings: {
                min: 1,
                max: 100,
              },
            } as any
          }
        />
      </Field>
      <Field label={'Marker Symbol'}>
        <ResourceDimensionEditor
          value={value.symbol ?? defaultStyleConfig.symbol}
          context={context}
          onChange={onResourceChange}
          item={
            {
              settings: {
                resourceType: 'icon',
                showSourceRadio: false,
                folderName: ResourceFolderName.Marker,
              },
            } as any
          }
        />
      </Field>
      <Field label={'Marker Color'}>
        <ColorDimensionEditor
          value={value.color ?? defaultStyleConfig.color}
          context={context}
          onChange={onColorChange}
          item={{} as any}
        />
      </Field>
      <Field label={'Fill opacity'}>
        <SliderValueEditor
          value={value.opacity ?? defaultStyleConfig.opacity}
          context={context}
          onChange={onOpacityChange}
          item={
            {
              settings: {
                min: 0,
                max: 1,
                step: 0.1,
              },
            } as any
          }
        />
      </Field>
    </>
  );
};
