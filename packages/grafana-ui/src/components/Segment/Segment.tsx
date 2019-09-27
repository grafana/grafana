import React, { useState, useRef } from 'react';
import { SelectableValue } from '@grafana/data';
import { SegmentSelect } from './SegmentSelect';
import { OptionType } from './GroupBy';

export interface Props<T> {
  currentOption: SelectableValue<T>;
  options: OptionType<T> | undefined;
  onChange: (item: SelectableValue<T>) => void;
  className?: string;
}

export function Segment<T>({ options, currentOption: { label }, onChange }: React.PropsWithChildren<Props<T>>) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [labelWidth, setLabelWidth] = useState();

  if (!expanded) {
    return (
      <div className="gf-form" ref={ref}>
        <a
          className="gf-form-label query-part"
          onClick={() => {
            ref && ref.current && setLabelWidth(ref.current.clientWidth);
            setExpanded(true);
          }}
        >
          {label}
        </a>
      </div>
    );
  }

  return (
    <SegmentSelect
      width={labelWidth}
      // removeOptionText={removeOptionText}
      options={options}
      onClickOutside={() => setExpanded(false)}
      onChange={item => {
        setExpanded(false);
        onChange(item);
      }}
    />
  );
}
