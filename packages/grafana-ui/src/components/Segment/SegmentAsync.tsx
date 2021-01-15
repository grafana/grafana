import React, { HTMLProps } from 'react';
import { cx } from 'emotion';
import _ from 'lodash';
import { SegmentSelect } from './SegmentSelect';
import { SelectableValue } from '@grafana/data';
import { useExpandableLabel, SegmentProps } from '.';
import { useAsyncFn } from 'react-use';
import { AsyncState } from 'react-use/lib/useAsync';

export interface SegmentAsyncProps<T> extends SegmentProps<T>, Omit<HTMLProps<HTMLDivElement>, 'value' | 'onChange'> {
  value?: T | SelectableValue<T>;
  loadOptions: (query?: string) => Promise<Array<SelectableValue<T>>>;
  onChange: (item: SelectableValue<T>) => void;
}

export function SegmentAsync<T>({
  value,
  onChange,
  loadOptions,
  Component,
  className,
  allowCustomValue,
  placeholder,
  ...rest
}: React.PropsWithChildren<SegmentAsyncProps<T>>) {
  const [state, fetchOptions] = useAsyncFn(loadOptions, [loadOptions]);
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false);

  if (!expanded) {
    const label = _.isObject(value) ? value.label : value;
    return (
      <Label
        onClick={fetchOptions}
        Component={
          Component || (
            <a className={cx('gf-form-label', 'query-part', !value && placeholder && 'query-placeholder', className)}>
              {label || placeholder}
            </a>
          )
        }
      />
    );
  }

  return (
    <SegmentSelect
      {...rest}
      value={value && !_.isObject(value) ? { value } : value}
      options={state.value ?? []}
      width={width}
      noOptionsMessage={mapStateToNoOptionsMessage(state)}
      allowCustomValue={allowCustomValue}
      onClickOutside={() => {
        setExpanded(false);
      }}
      onChange={item => {
        setExpanded(false);
        onChange(item);
      }}
    />
  );
}

function mapStateToNoOptionsMessage<T>(state: AsyncState<Array<SelectableValue<T>>>): string {
  if (state.loading) {
    return 'Loading options...';
  }

  if (state.error) {
    return 'Failed to load options';
  }

  if (!Array.isArray(state.value) || state.value.length === 0) {
    return 'No options found';
  }

  return '';
}
