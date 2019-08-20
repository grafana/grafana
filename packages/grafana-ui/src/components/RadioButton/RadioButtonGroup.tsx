import React from 'react';
import { css } from 'emotion';
import { toggleLabel } from './RadioButton';

const groupStyles = css`
  display: flex;
  flex-wrap: wrap;
  .${toggleLabel}:first-of-type {
    border-radius: 2px 0 0 2px;
  }
  .${toggleLabel}:last-of-type {
    border-radius: 2px 0 0 2px;
  }
`;

interface Props {
  children: JSX.Element[];
  name?: string;
}

export const RadioButtonGroup = ({ children, name }: Props) => {
  let renderedChildren;
  if (name) {
    renderedChildren = children.map(child => React.cloneElement(child, { name, key: child.props.id }));
  } else {
    renderedChildren = children;
  }
  return <div className={groupStyles}>{renderedChildren}</div>;
};
