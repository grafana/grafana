import React, { useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { OptionType } from './GroupBy';
import { SegmentSelect } from './SegmentSelect';

export interface Props<T> {
  options: OptionType<T> | undefined;
  onChange: (item: SelectableValue<T>) => void;
  className?: string;
}

export function SegmentAdd<T>({ options, onChange, className }: React.PropsWithChildren<Props<T>>) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <div className="gf-form">
        <a onClick={() => setExpanded(true)} className="gf-form-label ng-binding ng-scope query-part">
          <i className="fa fa-plus " />
        </a>
      </div>
    );
  }

  return (
    <SegmentSelect
      options={options}
      onClickOutside={() => setExpanded(false)}
      onChange={item => {
        setExpanded(false);
        onChange(item);
      }}
    />
  );
}
