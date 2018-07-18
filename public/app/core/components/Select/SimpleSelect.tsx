import React from 'react';

export interface Props {
  value: string;
  options: string[];
  className?: string;
  onChange: (value: string) => any;
}

export function SimpleSelect(props: Props) {
  function onChange(e) {
    const newValue = e.target.value;
    props.onChange(newValue);
  }

  const selectClassName = props.className;
  const value = props.value;
  const options = props.options;

  return (
    <select className={selectClassName} value={value} onChange={onChange}>
      {options.map((option, index) => (
        <option value={option} key={index.toString()}>
          {option}
        </option>
      ))}
    </select>
  );
}
