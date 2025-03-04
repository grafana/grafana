import { SelectableValue } from '@grafana/data';

import { SelectBase } from './SelectBase';
import { SelectContainer, SelectContainerProps } from './SelectContainer';
import {
  SelectCommonProps,
  MultiSelectCommonProps,
  SelectAsyncProps,
  VirtualizedSelectProps,
  VirtualizedSelectAsyncProps,
} from './types';

/** @deprecated Use Combobox component instead */
export function Select<T, Rest = {}>(props: SelectCommonProps<T> & Rest) {
  return <SelectBase {...props} />;
}

export function MultiSelect<T, Rest = {}>(props: MultiSelectCommonProps<T> & Rest) {
  // @ts-ignore
  return <SelectBase {...props} isMulti />;
}

export interface AsyncSelectProps<T> extends Omit<SelectCommonProps<T>, 'options'>, SelectAsyncProps<T> {
  // AsyncSelect has options stored internally. We cannot enable plain values as we don't have access to the fetched options
  value?: T | SelectableValue<T> | null;
}

/** @deprecated Use Combobox component instead */
export function AsyncSelect<T, Rest = {}>(props: AsyncSelectProps<T> & Rest) {
  return <SelectBase {...props} />;
}

/** @deprecated Use Combobox component instead - it's virtualised by default! */
export function VirtualizedSelect<T, Rest = {}>(props: VirtualizedSelectProps<T> & Rest) {
  return <SelectBase virtualized {...props} />;
}

/** @deprecated Use Combobox component instead - it's virtualised by default! */
export function AsyncVirtualizedSelect<T, Rest = {}>(props: VirtualizedSelectAsyncProps<T> & Rest) {
  return <SelectBase virtualized {...props} />;
}

interface AsyncMultiSelectProps<T> extends Omit<MultiSelectCommonProps<T>, 'options'>, SelectAsyncProps<T> {
  // AsyncSelect has options stored internally. We cannot enable plain values as we don't have access to the fetched options
  value?: Array<SelectableValue<T>>;
}

export function AsyncMultiSelect<T, Rest = {}>(props: AsyncMultiSelectProps<T> & Rest) {
  // @ts-ignore
  return <SelectBase {...props} isMulti />;
}

export { SelectContainer, type SelectContainerProps };
