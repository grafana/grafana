import React from 'react';

import { StandardEditorProps, FieldNamePickerBaseNameMode } from '@grafana/data';
import { Field } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { ColorDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';

import { Options, ScatterSeriesConfig } from './panelcfg.gen';

export const ScatterSeriesEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<ScatterSeriesConfig, unknown, Options>) => {
  const onFieldChange = (val: unknown | undefined, field: string) => {
    onChange({ ...value, [field]: val });
  };

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
              baseNameMode: FieldNamePickerBaseNameMode.ExcludeBaseNames,
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
            id: 'x',
            name: 'x',
            settings: {
              baseNameMode: FieldNamePickerBaseNameMode.ExcludeBaseNames,
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
              baseNameMode: FieldNamePickerBaseNameMode.ExcludeBaseNames,
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
