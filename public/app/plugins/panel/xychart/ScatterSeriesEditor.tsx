import React from 'react';

import { StandardEditorProps, FieldNamePickerBaseNameMode, FieldMatcherID } from '@grafana/data';
import { Field } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { Options } from './panelcfg.gen';
import { XYSeriesConfig } from './types2';

export interface Props extends StandardEditorProps<XYSeriesConfig, unknown, Options> {
  baseNameMode: FieldNamePickerBaseNameMode;
  frameFilter?: number;
}

export const ScatterSeriesEditor = ({ value, onChange, context, baseNameMode, frameFilter = -1 }: Props) => {
  const onFieldChange = (val: any | undefined, field: string) => {
    if (val) {
      onChange({
        ...value,
        [field]: {
          matcher: { id: FieldMatcherID.byName, options: val },
        },
      });
    } else {
      onChange({ ...value, [field]: undefined });
    }
  };

  const frame = context.data && frameFilter > -1 ? context.data[frameFilter] : undefined;

  return (
    <div>
      <Field label={'X Field'}>
        <FieldNamePicker
          value={value.x.matcher.options ?? ''}
          context={context}
          onChange={(field) =>
            onChange({
              ...value,
              x: {
                matcher: {
                  id: FieldMatcherID.byName,
                  options: field,
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
          value={value.y?.matcher?.options ?? ''}
          context={context}
          onChange={(field) =>
            onChange({
              ...value,
              y: {
                matcher: {
                  id: FieldMatcherID.byName,
                  options: field,
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
      <Field label={'Color field'}>
        <FieldNamePicker
          value={value.color ? value.color?.matcher.options : undefined}
          context={context}
          onChange={(field) => onFieldChange(field, 'color')}
          item={{
            id: 'color',
            name: 'color',
            settings: {
              filter: (field) =>
                frame?.fields.some((obj) => obj.state?.displayName === field.state?.displayName) ?? true,
              baseNameMode,
              isClearable: true,
              placeholderText: 'Use default color scheme or field config',
            },
          }}
        />
      </Field>
      <Field label={'Size field'}>
        <FieldNamePicker
          value={value.size ? value.size?.matcher.options : undefined}
          context={context}
          onChange={(field) => onFieldChange(field, 'size')}
          item={{
            id: 'size',
            name: 'size',
            settings: {
              filter: (field) =>
                frame?.fields.some((obj) => obj.state?.displayName === field.state?.displayName) ?? true,
              baseNameMode,
              isClearable: true,
              placeholderText: 'Use default size or field config',
            },
          }}
        />
      </Field>
    </div>
  );
};
