import React, { useState } from 'react';
import { cx } from 'emotion';
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
}: React.PropsWithChildren<SegmentAsyncProps<T>>) {
  const [selectPlaceholder, setSelectPlaceholder] = useState<string>('');
  const [loadedOptions, setLoadedOptions] = useState<Array<SelectableValue<T>>>([]);
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false);

  if (!expanded) {
    return (
      <Label
        onClick={async () => {
          setSelectPlaceholder('Loading options...');
          const opts = await loadOptions();
          setLoadedOptions(opts);
          setSelectPlaceholder(opts.length ? '' : 'No options found');
        }}
        Component={Component || <a className={cx('gf-form-label', 'query-part', className)}>{value}</a>}
      />
    );
  }

  return (
    <SegmentSelect
      width={width}
      options={loadedOptions}
      noOptionsMessage={selectPlaceholder}
      allowCustomValue={allowCustomValue}
      onClickOutside={() => {
        setSelectPlaceholder('');
        setLoadedOptions([]);
        setExpanded(false);
      }}
      onChange={value => {
        setSelectPlaceholder('');
        setLoadedOptions([]);
        setExpanded(false);
        onChange(value);
      }}
    />
  );
}
