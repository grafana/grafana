import React, { useState, FC } from 'react';
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
  initial?: string;
  onChange?: (newId: string) => void;
}

export const RadioButtonGroup: FC<Props> = ({ children, name, initial, onChange }) => {
  const [selected, setSelected] = useState(initial);
  const handleChange = (newId: string) => {
    setSelected(newId);
    if (onChange) {
      onChange(newId);
    }
  };

  let renderedChildren;
  if (name) {
    renderedChildren = children.map(child =>
      React.cloneElement(child, {
        name,
        key: child.props.id,
        checked: name === selected,
        onChange: handleChange,
      })
    );
  } else {
    renderedChildren = children;
  }
  return <div className={groupStyles}>{renderedChildren}</div>;
};
