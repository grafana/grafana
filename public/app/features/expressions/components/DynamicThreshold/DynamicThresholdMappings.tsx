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
        const error = errors.find((error) => error.location.mappingIndex === index)?.message;
        return (
          <Stack key={index} direction="row" gap={1} alignItems="flex-start">
            <Field
              noMargin
              label={index === 0 ? t('expressions.dynamic-threshold.label-value', 'Label value') : undefined}
              invalid={error ? true : undefined}
              error={error}
            >
              <Select
                aria-label={t('expressions.dynamic-threshold.label-value', 'Label value')}
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
                  aria-label={t('expressions.dynamic-threshold.threshold-input', 'Threshold {{number}}', {
                    number: thresholdIndex + 1,
                  })}
                  type="number"
                  value={mapping.thresholds[thresholdIndex] ?? ''}
                  onChange={(event) => {
                    const thresholds = [...mapping.thresholds];
                    const value = event.currentTarget.value;
                    if (value === '') {
                      thresholds.splice(thresholdIndex, 1);
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
                aria-label={t('expressions.dynamic-threshold.move-up', 'Move mapping up')}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              />
              <IconButton
                name="arrow-down"
                aria-label={t('expressions.dynamic-threshold.move-down', 'Move mapping down')}
                disabled={index === mappings.length - 1}
                onClick={() => move(index, 1)}
              />
              <IconButton
                name="trash-alt"
                aria-label={t('expressions.dynamic-threshold.remove-mapping', 'Remove mapping')}
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
