import { type FormEvent, useMemo, useRef, useState } from 'react';

import { type DataFrame, getFieldDisplayName, type SelectableValue } from '@grafana/data';
import {
  CalculateFieldMode,
  type CalculateFieldTransformerOptions,
  getFieldTemplateReference,
  parseFieldTemplate,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineField, Input, Select } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { LABEL_WIDTH } from './constants';

export const TemplateOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  input: DataFrame[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, onChange } = props;
  const [template, setTemplate] = useState(options.template?.template ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const updateTemplate = (value: string) => {
    setTemplate(value);
    onChange({
      ...options,
      mode: CalculateFieldMode.Template,
      template: { ...options.template, template: value },
    });
  };

  const onDecimalsChange = (value?: number) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.Template,
      template: { template, decimals: value === undefined ? undefined : Math.floor(value) },
    });
  };

  // `names` also carries dashboard variables as `$name`, which aren't fields.
  const fieldNames = useMemo(() => props.names.filter((name) => !name.startsWith('$')), [props.names]);
  const fieldOptions = fieldNames.map((name) => ({ label: name, value: name }));

  // The transformer resolves raw names and display names of every field type, not only the pickable ones.
  const knownNames = useMemo(() => {
    const known = new Set(fieldNames);
    for (const frame of props.input) {
      for (const field of frame.fields) {
        known.add(field.name);
        known.add(getFieldDisplayName(field, frame, props.input));
      }
    }
    return known;
  }, [fieldNames, props.input]);

  const onInsertField = (v: SelectableValue<string>) => {
    if (v.value) {
      const reference = getFieldTemplateReference(v.value);
      const position = inputRef.current?.selectionStart ?? template.length;
      const cursor = position + reference.length;
      updateTemplate(template.slice(0, position) + reference + template.slice(position));
      // Setting the value from code moves the cursor to the end, so restore it after React commits.
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(cursor, cursor));
    }
  };

  const unknownFields =
    knownNames.size > 0
      ? parseFieldTemplate(template).flatMap((part) =>
          'field' in part && !knownNames.has(part.field) ? [part.field] : []
        )
      : [];

  return (
    <>
      <InlineField
        labelWidth={LABEL_WIDTH}
        label={t('transformers.template-options-editor.label-template', 'Template')}
        tooltip={t(
          'transformers.template-options-editor.tooltip-template',
          'Combine text and field values into a string. Reference a field with ${__data.fields.name}.'
        )}
        invalid={unknownFields.length > 0}
        error={
          unknownFields.length > 0
            ? t('transformers.template-options-editor.error-unknown-fields', 'Unknown fields: {{fields}}', {
                fields: unknownFields.join(', '),
              })
            : undefined
        }
        grow
      >
        <Input
          ref={inputRef}
          value={template}
          placeholder={t(
            'transformers.template-options-editor.placeholder-template',
            '${__data.fields.host}: ${__data.fields.message}'
          )}
          onChange={(e: FormEvent<HTMLInputElement>) => setTemplate(e.currentTarget.value)}
          onBlur={(e: FormEvent<HTMLInputElement>) => updateTemplate(e.currentTarget.value)}
        />
      </InlineField>
      <InlineField
        labelWidth={LABEL_WIDTH}
        label={t('transformers.template-options-editor.label-insert-field', 'Insert field')}
      >
        <Select
          className="width-18"
          aria-label={t('transformers.template-options-editor.aria-label-insert-field', 'Insert field')}
          placeholder={t('transformers.template-options-editor.placeholder-insert-field', 'Select field')}
          options={fieldOptions}
          value={null}
          onChange={onInsertField}
        />
      </InlineField>
      <InlineField
        labelWidth={LABEL_WIDTH}
        label={t('transformers.template-options-editor.label-decimals', 'Decimals')}
        tooltip={t(
          'transformers.template-options-editor.tooltip-decimals',
          'Decimals for numbers in the template. Panel decimals do not apply because they are set after transformations run.'
        )}
      >
        <NumberInput
          width={18}
          min={0}
          max={15}
          placeholder={t('transformers.template-options-editor.placeholder-decimals', 'auto')}
          value={options.template?.decimals}
          onChange={onDecimalsChange}
        />
      </InlineField>
    </>
  );
};
