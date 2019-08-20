import React, { FC } from 'react';
import { css } from 'emotion';

export const toggleLabel = css`
  position: relative;
  font-family: 'Roboto';
  color: #8e8e8e;
  font-weight: 500;
  font-size: 14px;
  line-height: 1;

  margin-left: -1px;
  padding: 9px 16px 9px 16px;
  border: 1px solid #555555;
  background-color: #161719;
  cursor: pointer;
  z-index: 1;

  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  &:hover {
    color: #5794f2;
  }
`;

const toggle = css`
  position: absolute;
  top: 0;
  left: -100vw;
  opacity: 0;
  z-index: -1000;

  &:checked + .${toggleLabel} {
    border-color: #5794f2;
    color: #5794f2;
    z-index: 2;
  }

  &:focus + .${toggleLabel} {
    outline-offset: 2px;
    outline: solid 2px blue;
    z-index: 2;
  }
`;

interface Props {
  //  Name can be set via RadioButtonGroup
  name?: string;
  id: string;
  children: string;
  onChange?: (newName: string) => void;
}

export const RadioButton: FC<Props> = ({ name, id, children, onChange }) => {
  if (!name) {
    throw new Error("RadioButton needs 'name' property to be set.");
  }
  const handleClick = () => {
    if (onChange) {
      onChange(id);
    }
  };
  return (
    <>
      <input tabIndex={0} onChange={handleClick} type="radio" name={name} id={id} className={toggle} />
      <label tabIndex={-1} onClick={handleClick} className={toggleLabel} htmlFor={id}>
        {children}
      </label>
    </>
  );
};
