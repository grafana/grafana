import React, { FC } from 'react';

interface Props {
  onValueChange: (e: any) => void;
  options: any[];
  value: string;
  label: string;
}

const SimpleSelect: FC<Props> = props => {
  const { label, onValueChange, value, options } = props;
  return (
    <div className="gf-form max-width-21">
      <span className="gf-form-label width-10 query-keyword">{label}</span>
      <div className="gf-form-select-wrapper max-width-12">
        <select className="gf-form-input" required onChange={onValueChange} value={value}>
          {options.map(({ value, name }, i) => (
            <option key={i} value={value}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default SimpleSelect;
