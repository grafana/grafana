import React from 'react';
import { css } from 'emotion';

const toggleLabel = css`
  position: relative;
  $font-size: 14px;
  $box-height: 32px;
  $box-padding: ($box-height - $font-size)/2;
  font-family: 'Roboto';
  color: #8e8e8e;
  font-weight: 500;
  font-size: $font-size;
  line-height: 1;

  margin-left: -1px;
  padding: $box-padding 16px $box-padding 16px;
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
  .toggle {
    position: absolute;
    top: 0;
    left: -100vw;
    opacity: 0;
    z-index: -1000;

    &:checked + ${toggleLabel} {
      border-color: #5794f2;
      color: #5794f2;
      z-index: 2;
    }
  }
`;

interface Props {
  name: string;
  id: string;
  className?: string;
  children: JSX.Element;
}

export const RadioButton = ({ name, id, children }: Props) => (
  <>
    <input type="radio" name={name} id={id} className={toggle} />
    <label className={toggleLabel} htmlFor={id}>
      {children}
    </label>
  </>
);
