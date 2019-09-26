import React, { useState } from 'react';
import { OptionType } from './GroupBy';
import { SegmentSelect } from './SegmentSelect';

export interface Props {
  options: OptionType;
  onChange: (value: string) => void;
  className?: string;
}

export const SegmentAdd: React.FunctionComponent<Props> = ({ options, onChange, className }) => {
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
      onChange={value => {
        setExpanded(false);
        onChange(value);
      }}
    />
  );
};
