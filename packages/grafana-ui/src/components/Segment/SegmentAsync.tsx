import React, { useState, ReactElement } from 'react';
import { SelectableValue } from '@grafana/data';
import { SegmentSelect } from './SegmentSelect';
import { OptionType, useExpandableLabel } from '.';

export interface SegmentAsyncProps<T> {
  onChange: (item: SelectableValue<T>) => void;
  loadOptions: () => Promise<Array<SelectableValue<T>>>;
  currentOption?: SelectableValue<T>;
  Component?: ReactElement;
}

export function SegmentAsync<T>({
  currentOption: { label } = { label: '' },
  onChange,
  loadOptions,
  Component,
}: React.PropsWithChildren<SegmentAsyncProps<T>>) {
  const [selectPlaceholder, setSelectPlaceholder] = useState<string>('');
  const [loadedOptions, setLoadedOptions] = useState<OptionType<T>>([]);
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
        Component={Component || <a className="gf-form-label query-part">{label}</a>}
      />
    );
  }

  return (
    <SegmentSelect
      width={width}
      options={loadedOptions}
      noOptionsMessage={selectPlaceholder}
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
