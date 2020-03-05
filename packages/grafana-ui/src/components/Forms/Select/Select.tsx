import React from 'react';
import { SelectableValue } from '@grafana/data';
import { SelectCommonProps, MultiSelectCommonProps, SelectAsyncProps } from './types';
import { SelectBase } from './SelectBase';

export function Select<T>(props: SelectCommonProps<T>) {
  return <SelectBase {...props} />;
}

export function MultiSelect<T>(props: MultiSelectCommonProps<T>) {
  // @ts-ignore
  return <SelectBase {...props} isMulti />;
}

interface AsyncSelectProps<T> extends Omit<SelectCommonProps<T>, 'options'>, SelectAsyncProps<T> {
  // AsyncSelect has options stored internally. We cannot enable plain values as we don't have access to the fetched options
  value?: SelectableValue<T>;
}

export function AsyncSelect<T>(props: AsyncSelectProps<T>) {
  return <SelectBase {...props} />;
}

interface AsyncMultiSelectProps<T> extends Omit<MultiSelectCommonProps<T>, 'options'>, SelectAsyncProps<T> {
  // AsyncSelect has options stored internally. We cannot enable plain values as we don't have access to the fetched options
  value?: Array<SelectableValue<T>>;
}

export function AsyncMultiSelect<T>(props: AsyncMultiSelectProps<T>) {
  // @ts-ignore
  return <SelectBase {...props} isMulti />;
}
