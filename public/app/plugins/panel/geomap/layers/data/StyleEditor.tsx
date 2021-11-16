import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Field, HorizontalGroup, NumberValueEditor, RadioButtonGroup, SliderValueEditor } from '@grafana/ui';

import {
  ColorDimensionEditor,
  ResourceDimensionEditor,
  ScaleDimensionEditor,
  TextDimensionEditor,
} from 'app/features/dimensions/editors';
import {
  ScaleDimensionConfig,
  ResourceDimensionConfig,
  ColorDimensionConfig,
  ResourceFolderName,
  TextDimensionConfig,
  defaultTextConfig,
} from 'app/features/dimensions/types';
import { defaultStyleConfig, StyleConfig, TextAlignment, TextBaseline } from '../../style/types';

export const StyleEditor: FC<StandardEditorProps<StyleConfig, any, any>> = ({ value, context, onChange }) => {
  const onSizeChange = (sizeValue: ScaleDimensionConfig | undefined) => {
    onChange({ ...value, size: sizeValue });
  };

  const onSymbolChange = (symbolValue: ResourceDimensionConfig | undefined) => {
    onChange({ ...value, symbol: symbolValue });
  };

  const onColorChange = (colorValue: ColorDimensionConfig | undefined) => {
    onChange({ ...value, color: colorValue });
  };

  const onOpacityChange = (opacityValue: number | undefined) => {
    onChange({ ...value, opacity: opacityValue });
  };

  const onTextChange = (textValue: TextDimensionConfig | undefined) => {
    onChange({ ...value, text: textValue });
  };

  const onTextFontSizeChange = (fontSize: number | undefined) => {
    onChange({ ...value, textConfig: { ...value.textConfig, fontSize } });
  };

  const onTextOffsetXChange = (offsetX: number | undefined) => {
    onChange({ ...value, textConfig: { ...value.textConfig, offsetX } });
  };

  const onTextOffsetYChange = (offsetY: number | undefined) => {
    onChange({ ...value, textConfig: { ...value.textConfig, offsetY } });
  };

  const onTextAlignChange = (textAlign: unknown) => {
    onChange({ ...value, textConfig: { ...value.textConfig, textAlign: textAlign as TextAlignment } });
  };

  const onTextBaselineChange = (textBaseline: unknown) => {
    onChange({ ...value, textConfig: { ...value.textConfig, textBaseline: textBaseline as TextBaseline } });
  };

  return (
    <>
      <Field label={'Size'}>
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
      <Field label={'Symbol'}>
        <ResourceDimensionEditor
          value={value.symbol ?? defaultStyleConfig.symbol}
          context={context}
          onChange={onSymbolChange}
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
      <Field label={'Color'}>
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
      <Field label={'Text label'}>
        <TextDimensionEditor
          value={value.text ?? defaultTextConfig}
          context={context}
          onChange={onTextChange}
          item={{} as any}
        />
      </Field>
      {value.text?.fixed ||
        (value.text?.field && (
          <>
            <HorizontalGroup>
              <Field label={'Font size'}>
                <NumberValueEditor
                  value={value.textConfig?.fontSize ?? defaultStyleConfig.textConfig.fontSize}
                  context={context}
                  onChange={onTextFontSizeChange}
                  item={{} as any}
                />
              </Field>
              <Field label={'X offset'}>
                <NumberValueEditor
                  value={value.textConfig?.offsetX ?? defaultStyleConfig.textConfig.offsetX}
                  context={context}
                  onChange={onTextOffsetXChange}
                  item={{} as any}
                />
              </Field>
              <Field label={'Y offset'}>
                <NumberValueEditor
                  value={value.textConfig?.offsetY ?? defaultStyleConfig.textConfig.offsetY}
                  context={context}
                  onChange={onTextOffsetYChange}
                  item={{} as any}
                />
              </Field>
            </HorizontalGroup>
            <Field label={'Align'}>
              <RadioButtonGroup
                value={value.textConfig?.textAlign ?? defaultStyleConfig.textConfig.textAlign}
                onChange={onTextAlignChange}
                options={[
                  { value: TextAlignment.Left, label: TextAlignment.Left },
                  { value: TextAlignment.Center, label: TextAlignment.Center },
                  { value: TextAlignment.Right, label: TextAlignment.Right },
                ]}
              />
            </Field>
            <Field label={'Baseline'}>
              <RadioButtonGroup
                value={value.textConfig?.textBaseline ?? defaultStyleConfig.textConfig.textBaseline}
                onChange={onTextBaselineChange}
                options={[
                  { value: TextBaseline.Top, label: TextBaseline.Top },
                  { value: TextBaseline.Middle, label: TextBaseline.Middle },
                  { value: TextBaseline.Bottom, label: TextBaseline.Bottom },
                ]}
              />
            </Field>
          </>
        ))}
    </>
  );
};
