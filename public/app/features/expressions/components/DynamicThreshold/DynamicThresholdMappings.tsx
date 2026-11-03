import { t, Trans } from '@grafana/i18n';
import { Button, Field, IconButton, Input, Select, Stack } from '@grafana/ui';

import { type DynamicThresholdMapping } from '../../types';

import { type DynamicThresholdValidationError } from './buildDynamicThreshold';

interface Props {
  mappings: DynamicThresholdMapping[];
  labelValues: string[];
  thresholdCount: number;
  errors: DynamicThresholdValidationError[];
  onChange: (mappings: DynamicThresholdMapping[]) => void;
}

export function DynamicThresholdMappings({ mappings, labelValues, thresholdCount, errors, onChange }: Props) {
  const update = (index: number, mapping: DynamicThresholdMapping) => {
    onChange(mappings.map((current, currentIndex) => (currentIndex === index ? mapping : current)));
  };
  const move = (index: number, offset: number) => {
    const next = [...mappings];
    const [mapping] = next.splice(index, 1);
    next.splice(index + offset, 0, mapping);
    onChange(next);
  };

  return (
    <Stack direction="column" gap={1}>
      {mappings.map((mapping, index) => {
        const rowNumber = index + 1;
        const error = errors
          .filter((error) => error.location.mappingIndex === index)
          .map((error) => error.message)
          .join(' ');
        return (
          <Stack key={index} direction="row" gap={1} alignItems="flex-start">
            <Field
              noMargin
              label={index === 0 ? t('expressions.dynamic-threshold.label-value', 'Label value') : undefined}
              invalid={error ? true : undefined}
              error={error}
            >
              <Select
                aria-label={t('expressions.dynamic-threshold.mapping-label-value', 'Mapping row {{row}} label value', {
                  row: rowNumber,
                })}
                options={labelValues.map((value) => ({ value, label: value }))}
                value={mapping.labelValue ? { value: mapping.labelValue, label: mapping.labelValue } : null}
                allowCustomValue
                onChange={(option) => update(index, { ...mapping, labelValue: option?.value ?? '' })}
              />
            </Field>
            {Array.from({ length: thresholdCount }, (_, thresholdIndex) => (
              <Field
                noMargin
                key={thresholdIndex}
                label={
                  index === 0
                    ? thresholdCount === 1
                      ? t('expressions.dynamic-threshold.threshold', 'Threshold')
                      : thresholdIndex === 0
                        ? t('expressions.dynamic-threshold.lower-threshold', 'Lower threshold')
                        : t('expressions.dynamic-threshold.upper-threshold', 'Upper threshold')
                    : undefined
                }
              >
                <Input
                  aria-label={
                    thresholdCount === 1
                      ? t('expressions.dynamic-threshold.mapping-threshold-input', 'Mapping row {{row}} threshold', {
                          row: rowNumber,
                        })
                      : thresholdIndex === 0
                        ? t(
                            'expressions.dynamic-threshold.mapping-lower-threshold-input',
                            'Mapping row {{row}} lower threshold',
                            { row: rowNumber }
                          )
                        : t(
                            'expressions.dynamic-threshold.mapping-upper-threshold-input',
                            'Mapping row {{row}} upper threshold',
                            { row: rowNumber }
                          )
                  }
                  type="number"
                  value={mapping.thresholds[thresholdIndex] ?? ''}
                  onChange={(event) => {
                    const thresholds = [...mapping.thresholds];
                    const value = event.currentTarget.value;
                    if (value === '') {
                      thresholds[thresholdIndex] = undefined;
                    } else {
                      thresholds[thresholdIndex] = Number(value);
                    }
                    update(index, { ...mapping, thresholds });
                  }}
                />
              </Field>
            ))}
            <Stack direction="row" gap={0.5}>
              <IconButton
                name="arrow-up"
                aria-label={t('expressions.dynamic-threshold.move-up', 'Move mapping row {{row}} up', {
                  row: rowNumber,
                })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              />
              <IconButton
                name="arrow-down"
                aria-label={t('expressions.dynamic-threshold.move-down', 'Move mapping row {{row}} down', {
                  row: rowNumber,
                })}
                disabled={index === mappings.length - 1}
                onClick={() => move(index, 1)}
              />
              <IconButton
                name="trash-alt"
                aria-label={t('expressions.dynamic-threshold.remove-mapping', 'Remove mapping row {{row}}', {
                  row: rowNumber,
                })}
                onClick={() => onChange(mappings.filter((_, currentIndex) => currentIndex !== index))}
              />
            </Stack>
          </Stack>
        );
      })}
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={() => onChange([...mappings, { labelValue: '', thresholds: [] }])}
        >
          <Trans i18nKey="expressions.dynamic-threshold.add-mapping">Add mapping</Trans>
        </Button>
      </div>
    </Stack>
  );
}
