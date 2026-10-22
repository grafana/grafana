import { memo, useEffect, useRef } from 'react';

import { FieldType, type Field, type SelectableValue } from '@grafana/data';

import { type FilterOperator, type TableRow } from '../types';

import { DateRangeFilter } from './DateRangeFilter';
import { FilterPopupLayout } from './FilterPopupLayout';
import { NumericRangeFilter } from './NumericRangeFilter';
import { StringMatchingFilter } from './StringMatchingFilter';

export interface FilterPopupProps {
  stateKey?: string;
  rangeFiltersEnabled?: boolean;
  onApplyValues: (values: SelectableValue[]) => void;
  onApplyRange?: (range: { min?: number; max?: number; includeMissing: boolean }) => void;
  onClear: () => void;
  timeZone?: string;
  range?: { min?: number; max?: number; includeMissing: boolean };
  rows: TableRow[];
  filterValue?: Array<SelectableValue<unknown>>;
  onClose: () => void;
  field?: Field;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<FilterOperator>;
  setOperator: (item: SelectableValue<FilterOperator>) => void;
  buttonElement: HTMLButtonElement | null;
}

export const FilterPopup = memo((props: FilterPopupProps) => <FilterPopupEditor key={props.stateKey} {...props} />);

const FilterPopupEditor = memo((props: FilterPopupProps) => {
  const { buttonElement, onClose, onClear, onApplyRange, field, filterValue, rows, range, timeZone } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStartedInside = useRef(false);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        buttonElement?.focus();
      }
    }
    document.addEventListener('keyup', handleEscape);

    return () => {
      document.removeEventListener('keyup', handleEscape);
    };
  }, [onClose, buttonElement]);

  // Sliders can release a pointer gesture outside the popup; dismiss only on a separate outside click.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      pointerStartedInside.current = event.target instanceof Node && !!containerRef.current?.contains(event.target);
    };
    const onOutsideClick = (event: Event) => {
      const domNode = containerRef.current;
      if (!domNode) {
        return;
      }
      const startedInside = pointerStartedInside.current;
      pointerStartedInside.current = false;
      if (event.target instanceof Node && !domNode.contains(event.target) && !startedInside) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('click', onOutsideClick);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('click', onOutsideClick);
    };
  }, [onClose]);

  if (props.rangeFiltersEnabled && !filterValue && field) {
    const rangeProps = {
      field,
      rows,
      range,
      timeZone,
      onCancel: () => {
        onClose();
        buttonElement?.focus();
      },
      onClear: () => {
        onClear();
        onClose();
        buttonElement?.focus();
      },
      onApply: (next: { min?: number; max?: number; includeMissing: boolean }) => {
        onApplyRange?.(next);
        onClose();
        buttonElement?.focus();
      },
    };

    switch (field.type) {
      case FieldType.time:
        return (
          <FilterPopupLayout containerRef={containerRef}>
            <DateRangeFilter {...rangeProps} />
          </FilterPopupLayout>
        );
      case FieldType.number:
        return (
          <FilterPopupLayout containerRef={containerRef}>
            <NumericRangeFilter {...rangeProps} />
          </FilterPopupLayout>
        );
    }
  }

  return <StringMatchingFilter {...props} containerRef={containerRef} />;
});

FilterPopup.displayName = 'FilterPopup';
FilterPopupEditor.displayName = 'FilterPopupEditor';
