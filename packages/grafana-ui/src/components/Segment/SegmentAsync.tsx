import React, { useState } from 'react';
import { SegmentSelect } from './SegmentSelect';
import { SelectableValue } from '@grafana/data';
import { useExpandableLabel, SegmentProps } from '.';

export interface SegmentAsyncProps<T> extends SegmentProps<T> {
  loadOptions: (query?: string) => Promise<Array<SelectableValue<T>>>;
}

export function SegmentAsync<T>({
  value,
  onChange,
  loadOptions,
  Component,
  className,
  allowCustomValue,
  isMulti,
}: React.PropsWithChildren<SegmentAsyncProps<T>>) {
  const [selectPlaceholder, setSelectPlaceholder] = useState<string>('');
  const [loadedOptions, setLoadedOptions] = useState<Array<SelectableValue<T>>>([]);
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false, value, className, Component);

  if (!expanded) {
    return (
      <Label
        onClick={async () => {
          setSelectPlaceholder('Loading options...');
          const opts = await loadOptions();
          setLoadedOptions(opts);
          setSelectPlaceholder(opts.length ? '' : 'No options found');
        }}
      />
    );
  }

  return (
    <SegmentSelect
      width={width}
      options={loadedOptions}
      value={value}
      noOptionsMessage={selectPlaceholder}
      allowCustomValue={allowCustomValue}
      isMulti={isMulti}
      onClickOutside={() => {
        setSelectPlaceholder('');
        setLoadedOptions([]);
        setExpanded(false);
      }}
      onChange={value => {
        if (!isMulti) {
          setSelectPlaceholder('');
          setLoadedOptions([]);
          setExpanded(false);
        }
        onChange(value);
      }}
    />
  );
}
