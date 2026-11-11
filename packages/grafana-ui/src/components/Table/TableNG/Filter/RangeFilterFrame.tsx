import { type ReactNode, type Ref, useState } from 'react';

import { type Field } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { FieldValidationMessage } from '../../../Forms/FieldValidationMessage';
import { Stack } from '../../../Layout/Stack/Stack';
import { getDisplayName } from '../utils';

import { FilterMissingValues, FilterPopupFooter } from './FilterPopupLayout';
import { type RangeFilterProps } from './rangeFilterTypes';

const rangeSelectors = selectors.components.Panels.Visualization.TableNG.Filters.Range;

interface Props extends Pick<RangeFilterProps, 'range' | 'onApply' | 'onClear' | 'onCancel'> {
  field: Field;
  values: unknown[];
  finite: number[];
  min?: number;
  max?: number;
  invalid: boolean;
  validationId: string;
  containerRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export function RangeFilterFrame({
  field,
  values,
  finite,
  min,
  max,
  invalid,
  validationId,
  containerRef,
  range,
  onApply,
  onClear,
  onCancel,
  children,
}: Props) {
  const [includeMissing, setIncludeMissing] = useState(range?.includeMissing ?? false);
  const unbounded = min == null && max == null;
  const count = invalid
    ? 0
    : unbounded
      ? includeMissing
        ? values.length - finite.length
        : values.length
      : finite.filter((value) => (min == null || value >= min) && (max == null || value <= max)).length +
        (includeMissing ? values.length - finite.length : 0);

  return (
    <Stack
      ref={containerRef}
      direction="column"
      gap={1.5}
      role="group"
      aria-label={t('grafana-ui.table.range.label', 'Filter {{field}}', {
        field: getDisplayName(field),
        interpolation: { escapeValue: false },
      })}
    >
      {children}
      {invalid && (
        <FieldValidationMessage id={validationId}>
          {t('grafana-ui.table.range.invalid', 'Enter valid bounds with minimum no greater than maximum.')}
        </FieldValidationMessage>
      )}
      <FilterMissingValues
        value={includeMissing}
        onChange={setIncludeMissing}
        testId={rangeSelectors.includeMissingCheckbox}
      />
      <FilterPopupFooter
        selectedRows={count}
        totalRows={values.length}
        onClear={range !== undefined ? onClear : undefined}
        onCancel={onCancel}
        onApply={() => (unbounded && !includeMissing ? onClear() : onApply({ min, max, includeMissing }))}
        applyLabel={t('grafana-ui.table.range.apply', 'Apply')}
        applyDisabled={invalid}
        clearTestId={rangeSelectors.clearButton}
        cancelTestId={rangeSelectors.cancelButton}
        applyTestId={rangeSelectors.applyButton}
      />
    </Stack>
  );
}
