import React, { useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { SegmentSelect } from './SegmentSelect';
import { OptionType } from './GroupBy';

export interface Props<T> {
  value?: SelectableValue<T>;
  getOptions: () => Promise<SelectableValue<T>>;
  onChange: (value: SelectableValue<T>) => void;
  removeOptionText?: string;
}

export function SegmentAsync<T>({ value, removeOptionText, onChange, getOptions }: React.PropsWithChildren<Props<T>>) {
  const [expanded, setExpanded] = useState(false);
  const [loadedOptions, setLoadedOptions] = useState<OptionType<T>>([]);

  if (!expanded) {
    return (
      <div className="gf-form">
        <a
          className="gf-form-label query-part"
          onClick={() => {
            setExpanded(true);
            getOptions().then(opts => setLoadedOptions(opts));
          }}
        >
          {value}
        </a>
      </div>
    );
  }

  return (
    <SegmentSelect
      removeOptionText={removeOptionText}
      options={loadedOptions}
      onClickOutside={() => {
        setLoadedOptions([]);
        setExpanded(false);
      }}
      onChange={value => {
        setLoadedOptions([]);
        setExpanded(false);
        onChange(value);
      }}
    />
  );
}
