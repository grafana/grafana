import { useMemo } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { LabelsToFieldsMode, LabelsToFieldsOptions } from '@grafana/data/internal';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select, FilterPill, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';

const modes: Array<SelectableValue<LabelsToFieldsMode>> = [
  { value: LabelsToFieldsMode.Columns, label: 'Columns' },
  { value: LabelsToFieldsMode.Rows, label: 'Rows' },
];

export const LabelsAsFieldsTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<LabelsToFieldsOptions>) => {
  const labelWidth = 20;

  const { labelNames, selected } = useMemo(() => {
    let labelNames: Array<SelectableValue<string>> = [];
    let uniqueLabels: Record<string, boolean> = {};

    for (const frame of input) {
      for (const field of frame.fields) {
        if (!field.labels) {
          continue;
        }

        for (const labelName of Object.keys(field.labels)) {
          if (!uniqueLabels[labelName]) {
            labelNames.push({ value: labelName, label: labelName });
            uniqueLabels[labelName] = true;
          }
        }
      }
    }

    const selected = new Set(options.keepLabels?.length ? options.keepLabels : Object.keys(uniqueLabels));
    return { labelNames, selected };
  }, [options.keepLabels, input]);

  const onValueLabelChange = (value: SelectableValue<string> | null) => {
    onChange({ ...options, valueLabel: value?.value });
  };

  const onToggleSelection = (v: string) => {
    if (selected.has(v)) {
      selected.delete(v);
    } else {
      selected.add(v);
    }
    if (selected.size === labelNames.length || !selected.size) {
      const { keepLabels, ...rest } = options;
      onChange(rest);
    } else {
      onChange({ ...options, keepLabels: [...selected] });
    }
  };

  return (
    <div>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.labels-as-fields-transformer-editor.label-mode', 'Mode')}
          labelWidth={labelWidth}
        >
          <RadioButtonGroup
            options={modes}
            value={options.mode ?? LabelsToFieldsMode.Columns}
            onChange={(v) => onChange({ ...options, mode: v })}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.labels-as-fields-transformer-editor.label-labels', 'Labels')}
          labelWidth={labelWidth}
          shrink={true}
        >
          <Stack gap={0.5} wrap={'wrap'}>
            {labelNames.map((o, i) => {
              const label = o.label!;
              return (
                <FilterPill
                  key={`${label}/${i}`}
                  onClick={() => onToggleSelection(label)}
                  label={label}
                  selected={selected.has(label)}
                />
              );
            })}
          </Stack>
        </InlineField>
      </InlineFieldRow>
      {options.mode !== LabelsToFieldsMode.Rows && (
        <InlineFieldRow>
          <InlineField
            label={t('transformers.labels-as-fields-transformer-editor.label-value-field-name', 'Value field name')}
            labelWidth={labelWidth}
            tooltip={t(
              'transformers.labels-as-fields-transformer-editor.tooltip-replace-value-field-label',
              'Replace the value field name with a label'
            )}
            htmlFor="labels-to-fields-as-name"
          >
            <Select
              inputId="labels-to-fields-as-name"
              isClearable={true}
              allowCustomValue={false}
              placeholder={t(
                'transformers.labels-as-fields-transformer-editor.placeholder-optional-select-label',
                '(Optional) Select label'
              )}
              options={labelNames}
              value={options?.valueLabel}
              onChange={onValueLabelChange}
              className="min-width-16"
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
};

export const labelsToFieldsTransformerRegistryItem: TransformerRegistryItem<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  editor: LabelsAsFieldsTransformerEditor,
  transformation: standardTransformers.labelsToFieldsTransformer,
  name: standardTransformers.labelsToFieldsTransformer.name,
  description: `Groups series by time and return labels or tags as fields.
                Useful for showing time series with labels in a table where each label key becomes a separate column.`,
  categories: new Set([TransformerCategory.Reformat]),
  help: getTransformationContent(DataTransformerID.labelsToFields).helperDocs,
};
