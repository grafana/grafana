import { css } from '@emotion/css';
import { type ReactNode, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, IconButton, InlineField, InlineFieldRow, Select, Stack, useStyles2 } from '@grafana/ui';

import { type DynamicThresholdMapping } from '../../types';

import { ThresholdInputs } from './ThresholdInputs';
import { type DynamicThresholdValidationError } from './buildDynamicThreshold';

export const DYNAMIC_THRESHOLD_LABEL_WIDTH = 15;

interface Props {
  mappings: DynamicThresholdMapping[];
  labelValues: string[];
  thresholdCount: number;
  errors: DynamicThresholdValidationError[];
  onChange: (mappings: DynamicThresholdMapping[]) => void;
}

export function DynamicThresholdMappings({ mappings, labelValues, thresholdCount, errors, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const idPrefix = useId();
  // Rows are identified by position. Saved rows are checked right away; a row added in this session stays quiet until the user edits it.
  const [touchedRows, setTouchedRows] = useState<ReadonlySet<number>>(() => new Set(mappings.keys()));

  // Mappings cleared from outside (match label or input change) must not leave stale touched positions behind.
  if (mappings.length === 0 && touchedRows.size > 0) {
    setTouchedRows(new Set());
  }

  const touch = (index: number) => setTouchedRows((current) => new Set(current).add(index));
  const update = (index: number, mapping: DynamicThresholdMapping) => {
    touch(index);
    onChange(mappings.map((current, currentIndex) => (currentIndex === index ? mapping : current)));
  };
  const remove = (index: number) => {
    setTouchedRows(
      (current) => new Set(Array.from(current).flatMap((row) => (row === index ? [] : [row > index ? row - 1 : row])))
    );
    onChange(mappings.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <>
      {mappings.map((mapping, index) => {
        const rowNumber = index + 1;
        const hasContent = mapping.labelValue !== '' || mapping.thresholds.some((value) => value !== undefined);
        const error =
          touchedRows.has(index) || hasContent
            ? errors
                .filter((error) => error.location.mappingIndex === index)
                .map((error) => error.message)
                .join(' ')
            : '';
        return (
          <InlineFieldRow key={index}>
            <div className={styles.labelSpacer} />
            <InlineField invalid={error ? true : undefined} error={error}>
              <RowControls>
                <Select
                  inputId={`${idPrefix}-${index}-label-value`}
                  width={20}
                  aria-label={t(
                    'expressions.dynamic-threshold.mapping-label-value',
                    'Mapping row {{row}} label value',
                    { row: rowNumber }
                  )}
                  placeholder={t('expressions.dynamic-threshold.label-value-placeholder', 'Select label value')}
                  options={labelValues.map((value) => ({ value, label: value }))}
                  value={mapping.labelValue ? { value: mapping.labelValue, label: mapping.labelValue } : null}
                  allowCustomValue
                  onChange={(option) => update(index, { ...mapping, labelValue: option?.value ?? '' })}
                />
                <ThresholdInputs
                  idPrefix={`${idPrefix}-${index}-threshold`}
                  thresholds={mapping.thresholds}
                  thresholdCount={thresholdCount}
                  getAriaLabel={(thresholdIndex) =>
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
                  onChange={(thresholds) => update(index, { ...mapping, thresholds })}
                />
                <IconButton
                  name="trash-alt"
                  className={styles.remove}
                  aria-label={t('expressions.dynamic-threshold.remove-mapping', 'Remove mapping row {{row}}', {
                    row: rowNumber,
                  })}
                  onClick={() => remove(index)}
                />
              </RowControls>
            </InlineField>
          </InlineFieldRow>
        );
      })}
      <InlineFieldRow>
        <div className={styles.labelSpacer} />
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={() => onChange([...mappings, { labelValue: '', thresholds: [] }])}
        >
          <Trans i18nKey="expressions.dynamic-threshold.add-mapping">Add mapping</Trans>
        </Button>
      </InlineFieldRow>
    </>
  );
}

// InlineField injects validation props into its child; Stack would forward them to the DOM.
function RowControls({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" gap={0.5} alignItems="flex-start">
      {children}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Matches an InlineLabel of DYNAMIC_THRESHOLD_LABEL_WIDTH plus its right margin so rows start in the control column.
  labelSpacer: css({
    flexShrink: 0,
    width: theme.spacing(DYNAMIC_THRESHOLD_LABEL_WIDTH + 0.5),
  }),
  remove: css({
    alignSelf: 'center',
    marginLeft: theme.spacing(0.5),
  }),
});
