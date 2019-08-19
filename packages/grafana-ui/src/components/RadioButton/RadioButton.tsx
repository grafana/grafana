import React from 'react';

interface Props {
  name: string;
  id: string;
  className?: string;
  children: JSX.Element;
}

export const RadioButton = ({ name, id, className, children }: Props) => (
  <>
    <input type="radio" name={name} id={id} className={className} />
    <label className="radio-label" htmlFor={id}>
      {children}
    </label>
  </>
);
