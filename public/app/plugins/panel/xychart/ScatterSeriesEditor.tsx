import React from 'react';

import { StandardEditorProps, FieldNamePickerBaseNameMode } from '@grafana/data';
import { Field } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { ColorDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';

import { Options, ScatterSeriesConfig } from './panelcfg.gen';

export interface Props extends StandardEditorProps<ScatterSeriesConfig, unknown, Options> {
  baseNameMode: FieldNamePickerBaseNameMode;
  frameFilter?: number;
}

export const ScatterSeriesEditor = ({ value, onChange, context, baseNameMode, frameFilter = -1 }: Props) => {
  const onFieldChange = (val: unknown | undefined, field: string) => {
    onChange({ ...value, [field]: val });
  };

  const frame = context.data && frameFilter > -1 ? context.data[frameFilter] : undefined;

  return (
    <div>
      <Field label={'X Field'}>
        <FieldNamePicker
          value={value.x ?? ''}
          context={context}
          onChange={(field) => onFieldChange(field, 'x')}
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
          value={value.y ?? ''}
          context={context}
          onChange={(field) => onFieldChange(field, 'y')}
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
          value={value.pointColor!}
          context={context}
          onChange={(field) => onFieldChange(field, 'pointColor')}
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
          value={value.pointSize!}
          context={context}
          onChange={(field) => onFieldChange(field, 'pointSize')}
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
