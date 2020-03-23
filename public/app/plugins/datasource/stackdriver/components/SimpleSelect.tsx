import React, { ChangeEvent, FC } from 'react';

interface Props {
  onValueChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; name: string }>;
  value: string;
  label: string;
}

export const SimpleSelect: FC<Props> = props => {
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
