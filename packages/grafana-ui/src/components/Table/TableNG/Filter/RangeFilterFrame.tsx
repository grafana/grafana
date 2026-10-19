import { type ReactNode, type Ref, useEffect, useRef } from 'react';

import { type Field } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { FieldValidationMessage } from '../../../Forms/FieldValidationMessage';
import { Stack } from '../../../Layout/Stack/Stack';
import { getDisplayName } from '../utils';

import { FilterPopupFooter } from './FilterPopupLayout';
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

export function useRangeInputFocus() {
  const minimumRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // The closing column menu restores its trigger focus before this popup takes over.
    const frame = requestAnimationFrame(() => minimumRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return minimumRef;
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
  const count = invalid
    ? 0
    : finite.filter((value) => (min == null || value >= min) && (max == null || value <= max)).length;

  return (
    <Stack
      ref={containerRef}
      direction="column"
      gap={1.5}
      role="group"
      aria-label={t('grafana-ui.table.range.label', 'Filter {{field}}', { field: getDisplayName(field) })}
    >
      {children}
      {invalid && (
        <FieldValidationMessage id={validationId}>
          {t('grafana-ui.table.range.invalid', 'Enter valid bounds with minimum no greater than maximum.')}
        </FieldValidationMessage>
      )}
      <FilterPopupFooter
        selectedRows={count}
        totalRows={values.length}
        onClear={range !== undefined ? onClear : undefined}
        onCancel={onCancel}
        onApply={() => onApply({ min, max, includeMissing: false })}
        applyLabel={t('grafana-ui.table.range.apply', 'Apply')}
        applyDisabled={invalid}
        clearTestId={rangeSelectors.clearButton}
        cancelTestId={rangeSelectors.cancelButton}
        applyTestId={rangeSelectors.applyButton}
      />
    </Stack>
  );
}
