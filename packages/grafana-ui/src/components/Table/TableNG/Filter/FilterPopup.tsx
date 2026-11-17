import { memo, useEffect, useRef, type KeyboardEvent } from 'react';

import { FieldType, type Field, type SelectableValue } from '@grafana/data';

import { type RangeSelection } from '../transformations/rangeFilter';
import { type FilterOperator, type TableRow } from '../types';

import { DateRangeFilter } from './DateRangeFilter';
import { FilterPopupLayout } from './FilterPopupLayout';
import { NumericRangeFilter } from './NumericRangeFilter';
import { StringMatchingFilter } from './StringMatchingFilter';

export interface FilterPopupProps {
  stateKey?: string;
  rangeFiltersEnabled?: boolean;
  onApplyValues: (values: SelectableValue[], includeMissing?: boolean) => void;
  onApplyRange?: (range: RangeSelection) => void;
  onClear: () => void;
  timeZone?: string;
  range?: RangeSelection;
  includeMissing?: boolean;
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

  const closeAndRestoreFocus = () => {
    onClose();
    buttonElement?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
    }
  };

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
    window.addEventListener('click', onOutsideClick, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('click', onOutsideClick, true);
    };
  }, [onClose]);

  if (props.rangeFiltersEnabled && !filterValue && field) {
    const rangeProps = {
      field,
      rows,
      range,
      timeZone,
      onCancel: closeAndRestoreFocus,
      onClear: () => {
        onClear();
        closeAndRestoreFocus();
      },
      onApply: (next: RangeSelection) => {
        onApplyRange?.(next);
        closeAndRestoreFocus();
      },
    };

    switch (field.type) {
      case FieldType.time:
        return (
          <FilterPopupLayout containerRef={containerRef} onKeyDown={handleKeyDown}>
            <DateRangeFilter {...rangeProps} />
          </FilterPopupLayout>
        );
      case FieldType.number:
        return (
          <FilterPopupLayout containerRef={containerRef} onKeyDown={handleKeyDown}>
            <NumericRangeFilter {...rangeProps} />
          </FilterPopupLayout>
        );
    }
  }

  return (
    <StringMatchingFilter
      {...props}
      filterValue={filterValue ?? (range ? [] : undefined)}
      containerRef={containerRef}
      onClose={closeAndRestoreFocus}
      onKeyDown={handleKeyDown}
    />
  );
});

FilterPopup.displayName = 'FilterPopup';
FilterPopupEditor.displayName = 'FilterPopupEditor';
