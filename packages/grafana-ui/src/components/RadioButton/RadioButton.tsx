import React from 'react';
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
`;

interface Props {
  //  Name can be set via RadioButtonGroup
  name?: string;
  id: string;
  children: string;
}

export const RadioButton = ({ name, id, children }: Props) => (
  <>
    <input type="radio" name={name} id={id} className={toggle} />
    <label className={toggleLabel} htmlFor={id}>
      {children}
    </label>
  </>
);
