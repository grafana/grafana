import React, { ReactElement } from 'react';
import { SelectableValue } from '@grafana/data';
import { OptionType, SegmentSelect, useExpandableLabel } from './';

export interface Props<T> {
  onChange: (item: SelectableValue<T>) => void;
  options: OptionType<T> | undefined;
  currentOption?: SelectableValue<T>;
  Component?: ReactElement;
}

export function Segment<T>({
  options,
  currentOption: { label } = { label: '' },
  onChange,
  Component,
}: React.PropsWithChildren<Props<T>>) {
  const [Label, width, expanded, setExpanded] = useExpandableLabel(false);

  if (!expanded) {
    return <Label Component={Component || <a className="gf-form-label query-part">{label}</a>} />;
  }

  return (
    <SegmentSelect
      width={width}
      options={options}
      onClickOutside={() => setExpanded(false)}
      onChange={item => {
        setExpanded(false);
        onChange(item);
      }}
    />
  );
}
