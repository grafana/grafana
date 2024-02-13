import React from 'react';

import { StandardEditorProps, FieldNamePickerBaseNameMode, FieldMatcherID } from '@grafana/data';
import { Field } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { ColorDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';

import { Options } from './panelcfg.gen';
import { XYSeriesConfig } from './types2';

export interface Props extends StandardEditorProps<XYSeriesConfig, unknown, Options> {
  baseNameMode: FieldNamePickerBaseNameMode;
  frameFilter?: number;
}

export const ScatterSeriesEditor = ({ value, onChange, context, baseNameMode, frameFilter = -1 }: Props) => {
  const onFieldChange = (val: any | undefined, field: string) => {
    if (val && val.field) {
      onChange({
        ...value,
        [field]: {
          field: {
            matcher: { id: FieldMatcherID.byName, options: val.field },
            min: val.min ?? undefined,
            max: val.max ?? undefined,
          },
        },
      });
    } else if (val && val.fixed) {
      onChange({ ...value, [field]: { fixed: { value: val.fixed } } });
    } else {
      onChange({ ...value, [field]: undefined });
    }
  };

  const frame = context.data && frameFilter > -1 ? context.data[frameFilter] : undefined;

  return (
    <div>
      <Field label={'X Field'}>
        <FieldNamePicker
          value={value.x.field.matcher.options ?? ''}
          context={context}
          onChange={(field) =>
            onChange({
              ...value,
              x: {
                field: {
                  matcher: {
                    id: FieldMatcherID.byName,
                    options: field,
                  },
                },
              },
            })
          }
          item={{
            id: 'x',
            name: 'x',
            settings: {
              filter: (field) =>
                frame?.fields.some((obj) => obj.state?.displayName === field.state?.displayName) ?? true,
              baseNameMode,
              placeholderText: 'select X field',
            },
          }}
        />
      </Field>
      <Field label={'Y Field'}>
        <FieldNamePicker
          value={value.y.field.matcher.options ?? ''}
          context={context}
          onChange={(field) =>
            onChange({
              ...value,
              y: {
                field: {
                  matcher: {
                    id: FieldMatcherID.byName,
                    options: field,
                  },
                },
              },
            })
          }
          item={{
            id: 'y',
            name: 'y',
            settings: {
              filter: (field) =>
                frame?.fields.some((obj) => obj.state?.displayName === field.state?.displayName) ?? true,
              baseNameMode,
              placeholderText: 'select Y field',
            },
          }}
        />
      </Field>
      <Field label={'Point color'}>
        <ColorDimensionEditor
          // TODO create proper mapping for ColorDimensionConfig
          value={
            value.color?.fixed
              ? { fixed: value.color?.fixed.value }
              : value.color?.field
                ? { field: value.color?.field.matcher.options }
                : { field: undefined }
          }
          context={context}
          onChange={(field) => onFieldChange(field, 'color')}
          item={{
            id: 'x',
            name: 'x',
            settings: {
              baseNameMode,
              isClearable: true,
              placeholder: 'Use standard color scheme',
            },
          }}
        />
      </Field>
      <Field label={'Point size'}>
        <ScaleDimensionEditor
          // TODO create proper mapping for ScaleDimensionConfig
          value={
            value.size?.fixed
              ? { fixed: value.size?.fixed.value }
              : value.size?.field
                ? { field: value.size?.field.matcher.options, min: value.size?.field.min, max: value.size.field.max }
                : { fixed: 2 }
          }
          context={context}
          onChange={(field) => onFieldChange(field, 'size')}
          item={{
            id: 'x',
            name: 'x',
            settings: {
              min: 1,
              max: 100,
            },
          }}
        />
      </Field>
    </div>
  );
};
