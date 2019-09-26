import React, { useState } from 'react';
import { SegmentSelect } from './SegmentSelect';
import { OptionType } from './GroupBy';

export interface Props {
  value?: string;
  options: OptionType;
  onRemove?: () => void;
  onChange: (value: string) => void;
  removeOptionText?: string;
  className?: string;
}

export const Segment: React.FunctionComponent<Props> = ({ options, value, removeOptionText, onChange, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <div className="gf-form">
        <a className="gf-form-label query-part" onClick={() => setExpanded(true)}>
          {value}
        </a>
      </div>
    );
  }

  return (
    <SegmentSelect
      removeOptionText={removeOptionText}
      options={options}
      onClickOutside={() => setExpanded(false)}
      onChange={value => {
        setExpanded(false);
        if (removeOptionText && removeOptionText === value) {
          onRemove();
        } else {
          onChange(value);
        }
      }}
    />
  );
};
