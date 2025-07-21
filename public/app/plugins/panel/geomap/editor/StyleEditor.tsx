import { capitalize } from 'lodash';
import { useMemo } from 'react';
import { useObservable } from 'react-use';
import { Observable, of } from 'rxjs';

import { FieldConfigPropertyItem, StandardEditorProps, StandardEditorsRegistryItem, FrameMatcher } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  ScaleDimensionConfig,
  ResourceDimensionConfig,
  ColorDimensionConfig,
  TextDimensionConfig,
  ScalarDimensionConfig,
} from '@grafana/schema';
import {
  ColorPicker,
  Field,
  HorizontalGroup,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  RadioButtonGroup,
} from '@grafana/ui';
import { NumberValueEditor } from 'app/core/components/OptionsUI/number';
import { SliderValueEditor } from 'app/core/components/OptionsUI/slider';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { ResourceDimensionEditor } from 'app/features/dimensions/editors/ResourceDimensionEditor';
import { ScalarDimensionEditor } from 'app/features/dimensions/editors/ScalarDimensionEditor';
import { ScaleDimensionEditor } from 'app/features/dimensions/editors/ScaleDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { ResourceFolderName, defaultTextConfig, MediaType } from 'app/features/dimensions/types';

import {
  HorizontalAlign,
  VerticalAlign,
  defaultStyleConfig,
  GeometryTypeId,
  StyleConfig,
  TextAlignment,
  TextBaseline,
} from '../style/types';
import { styleUsesText } from '../style/utils';
import { LayerContentInfo } from '../utils/getFeatures';

export interface StyleEditorOptions {
  layerInfo?: Observable<LayerContentInfo>;
  simpleFixedValues?: boolean;
  displayRotation?: boolean;
  hideSymbol?: boolean;
  frameMatcher?: FrameMatcher;
}

type Props = StandardEditorProps<StyleConfig, StyleEditorOptions>;

export const StyleEditor = (props: Props) => {
  const { value, onChange, item } = props;
  const context = useMemo(() => {
    if (!item.settings?.frameMatcher) {
      return props.context;
    }

    return { ...props.context, data: props.context.data.filter(item.settings.frameMatcher) };
  }, [props.context, item.settings]);

  const settings = item.settings;

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

  const onRotationChange = (rotationValue: ScalarDimensionConfig | undefined) => {
    onChange({ ...value, rotation: rotationValue });
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

  const onTextAlignChange = (textAlign: TextAlignment) => {
    onChange({ ...value, textConfig: { ...value.textConfig, textAlign: textAlign } });
  };

  const onTextBaselineChange = (textBaseline: TextBaseline) => {
    onChange({ ...value, textConfig: { ...value.textConfig, textBaseline: textBaseline } });
  };

  const onAlignHorizontalChange = (alignHorizontal: HorizontalAlign) => {
    onChange({ ...value, symbolAlign: { ...value?.symbolAlign, horizontal: alignHorizontal } });
  };

  const onAlignVerticalChange = (alignVertical: VerticalAlign) => {
    onChange({ ...value, symbolAlign: { ...value?.symbolAlign, vertical: alignVertical } });
  };

  const propertyOptions = useObservable(settings?.layerInfo ?? of());
  const featuresHavePoints = propertyOptions?.geometryType === GeometryTypeId.Point;
  const hasTextLabel = styleUsesText(value);
  const maxFiles = 2000;

  // Simple fixed value display
  if (settings?.simpleFixedValues) {
    return (
      <>
        {featuresHavePoints && (
          <>
            <InlineFieldRow>
              <InlineField label={t('geomap.style-editor.label-symbol', 'Symbol')}>
                <ResourceDimensionEditor
                  value={value?.symbol ?? defaultStyleConfig.symbol}
                  context={context}
                  onChange={onSymbolChange}
                  item={
                    {
                      settings: {
                        resourceType: 'icon',
                        folderName: ResourceFolderName.Marker,
                        placeholderText: hasTextLabel
                          ? t('geomap.style-editor.placeholderText-select-symbol', 'Select a symbol')
                          : t(
                              'geomap.style-editor.placeholderText-select-symbol-or-add-text',
                              'Select a symbol or add a text label'
                            ),
                        placeholderValue: defaultStyleConfig.symbol.fixed,
                        showSourceRadio: false,
                        maxFiles,
                      },
                    } as StandardEditorsRegistryItem
                  }
                />
              </InlineField>
            </InlineFieldRow>
            <Field label={t('geomap.style-editor.label-rotation-angle', 'Rotation angle')}>
              <ScalarDimensionEditor
                value={value?.rotation ?? defaultStyleConfig.rotation}
                context={context}
                onChange={onRotationChange}
                item={
                  {
                    settings: {
                      min: defaultStyleConfig.rotation.min,
                      max: defaultStyleConfig.rotation.max,
                    },
                  } as StandardEditorsRegistryItem
                }
              />
            </Field>
          </>
        )}
        <InlineFieldRow>
          <InlineField label={t('geomap.style-editor.label-color', 'Color')} labelWidth={10}>
            <InlineLabel width={4}>
              <ColorPicker
                color={value?.color?.fixed ?? defaultStyleConfig.color.fixed}
                onChange={(v) => {
                  onColorChange({ fixed: v });
                }}
              />
            </InlineLabel>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label={t('geomap.style-editor.label-opacity', 'Opacity')} labelWidth={10} grow>
            <SliderValueEditor
              value={value?.opacity ?? defaultStyleConfig.opacity}
              context={context}
              onChange={onOpacityChange}
              item={
                {
                  settings: {
                    min: 0,
                    max: 1,
                    step: 0.1,
                  },
                } as FieldConfigPropertyItem
              }
            />
          </InlineField>
        </InlineFieldRow>
      </>
    );
  }

  return (
    <>
      <Field label={t('geomap.style-editor.label-size', 'Size')}>
        <ScaleDimensionEditor
          value={value?.size ?? defaultStyleConfig.size}
          context={context}
          onChange={onSizeChange}
          item={
            {
              settings: {
                min: 1,
                max: 100,
              },
            } as StandardEditorsRegistryItem
          }
        />
      </Field>
      {!settings?.hideSymbol && (
        <>
          <Field label={t('geomap.style-editor.label-symbol', 'Symbol')}>
            <ResourceDimensionEditor
              value={value?.symbol ?? defaultStyleConfig.symbol}
              context={context}
              onChange={onSymbolChange}
              item={
                {
                  settings: {
                    resourceType: MediaType.Icon,
                    folderName: ResourceFolderName.Marker,
                    placeholderText: hasTextLabel
                      ? t('geomap.style-editor.placeholderText-select-symbol', 'Select a symbol')
                      : t(
                          'geomap.style-editor.placeholderText-select-symbol-or-add-text',
                          'Select a symbol or add a text label'
                        ),
                    placeholderValue: defaultStyleConfig.symbol.fixed,
                    showSourceRadio: false,
                    maxFiles,
                  },
                } as StandardEditorsRegistryItem
              }
            />
          </Field>
          <Field label={t('geomap.style-editor.label-symbol-vertical-align', 'Symbol vertical align')}>
            <RadioButtonGroup
              value={value?.symbolAlign?.vertical ?? defaultStyleConfig.symbolAlign.vertical}
              onChange={onAlignVerticalChange}
              options={[
                { value: VerticalAlign.Top, label: t('geomap.style-editor.vertical-align-options.label-top', 'Top') },
                {
                  value: VerticalAlign.Center,
                  label: t('geomap.style-editor.vertical-align-options.label-center', 'Center'),
                },
                {
                  value: VerticalAlign.Bottom,
                  label: t('geomap.style-editor.vertical-align-options.label-bottom', 'Bottom'),
                },
              ]}
            />
          </Field>
          <Field label={t('geomap.style-editor.label-symbol-horizontal-align', 'Symbol horizontal align')}>
            <RadioButtonGroup
              value={value?.symbolAlign?.horizontal ?? defaultStyleConfig.symbolAlign.horizontal}
              onChange={onAlignHorizontalChange}
              options={[
                {
                  value: HorizontalAlign.Left,
                  label: t('geomap.style-editor.horizontal-align-options.label-left', 'Left'),
                },
                {
                  value: HorizontalAlign.Center,
                  label: t('geomap.style-editor.horizontal-align-options.label-center', 'Center'),
                },
                {
                  value: HorizontalAlign.Right,
                  label: t('geomap.style-editor.horizontal-align-options.label-right', 'Right'),
                },
              ]}
            />
          </Field>
        </>
      )}
      <Field label={t('geomap.style-editor.label-color', 'Color')}>
        <ColorDimensionEditor
          value={value?.color ?? defaultStyleConfig.color}
          context={context}
          onChange={onColorChange}
          item={{} as StandardEditorsRegistryItem}
        />
      </Field>
      <Field label={t('geomap.style-editor.label-fill-opacity', 'Fill opacity')}>
        <SliderValueEditor
          value={value?.opacity ?? defaultStyleConfig.opacity}
          context={context}
          onChange={onOpacityChange}
          item={
            {
              settings: {
                min: 0,
                max: 1,
                step: 0.1,
              },
            } as FieldConfigPropertyItem
          }
        />
      </Field>
      {settings?.displayRotation && (
        <Field label={t('geomap.style-editor.label-rotation-angle', 'Rotation angle')}>
          <ScalarDimensionEditor
            value={value?.rotation ?? defaultStyleConfig.rotation}
            context={context}
            onChange={onRotationChange}
            item={
              {
                settings: {
                  min: defaultStyleConfig.rotation.min,
                  max: defaultStyleConfig.rotation.max,
                },
              } as StandardEditorsRegistryItem
            }
          />
        </Field>
      )}
      <Field label={t('geomap.style-editor.label-text-label', 'Text label')}>
        <TextDimensionEditor
          value={value?.text ?? defaultTextConfig}
          context={context}
          onChange={onTextChange}
          item={{} as StandardEditorsRegistryItem}
        />
      </Field>

      {hasTextLabel && (
        <>
          <HorizontalGroup>
            <Field label={t('geomap.style-editor.label-font-size', 'Font size')}>
              <NumberValueEditor
                value={value?.textConfig?.fontSize ?? defaultStyleConfig.textConfig.fontSize}
                context={context}
                onChange={onTextFontSizeChange}
                item={{} as FieldConfigPropertyItem}
              />
            </Field>
            <Field label={t('geomap.style-editor.label-x-offset', 'X offset')}>
              <NumberValueEditor
                value={value?.textConfig?.offsetX ?? defaultStyleConfig.textConfig.offsetX}
                context={context}
                onChange={onTextOffsetXChange}
                item={{} as FieldConfigPropertyItem}
              />
            </Field>
            <Field label={t('geomap.style-editor.label-y-offset', 'Y offset')}>
              <NumberValueEditor
                value={value?.textConfig?.offsetY ?? defaultStyleConfig.textConfig.offsetY}
                context={context}
                onChange={onTextOffsetYChange}
                item={{} as FieldConfigPropertyItem}
              />
            </Field>
          </HorizontalGroup>
          <Field label={t('geomap.style-editor.label-align', 'Align')}>
            <RadioButtonGroup
              value={value?.textConfig?.textAlign ?? defaultStyleConfig.textConfig.textAlign}
              onChange={onTextAlignChange}
              options={[
                { value: TextAlignment.Left, label: capitalize(TextAlignment.Left) },
                { value: TextAlignment.Center, label: capitalize(TextAlignment.Center) },
                { value: TextAlignment.Right, label: capitalize(TextAlignment.Right) },
              ]}
            />
          </Field>
          <Field label={t('geomap.style-editor.label-baseline', 'Baseline')}>
            <RadioButtonGroup
              value={value?.textConfig?.textBaseline ?? defaultStyleConfig.textConfig.textBaseline}
              onChange={onTextBaselineChange}
              options={[
                { value: TextBaseline.Top, label: capitalize(TextBaseline.Top) },
                { value: TextBaseline.Middle, label: capitalize(TextBaseline.Middle) },
                { value: TextBaseline.Bottom, label: capitalize(TextBaseline.Bottom) },
              ]}
            />
          </Field>
        </>
      )}
    </>
  );
};
