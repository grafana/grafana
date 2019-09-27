import React from 'react';
import { OptionType, SegmentSelect, useExpandableLabel, SegmentProps } from './';

export interface SegmentSyncProps<T> extends SegmentProps<T> {
  options: OptionType<T> | undefined;
}

export function Segment<T>({
  options,
  currentOption: { label } = { label: '' },
  onChange,
  Component,
}: React.PropsWithChildren<SegmentSyncProps<T>>) {
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
