import React, { FC } from 'react';
import { css } from 'emotion';
import { stylesFactory } from '../../themes';
export interface SplitButtonsProps {
  children: any;
}

const getStyles = stylesFactory((children: number, current: number) => {
  //First
  if (current === 0) {
    return css`
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    `;
  }
  //Last
  if (children - 1 === current) {
    return css`
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    `;
  }

  return css`
    border-radius: 0;
  `;
});

export const SplitButtons: FC<SplitButtonsProps> = ({ children }) => {
  const newChildren = React.Children.map(children, (child, i) =>
    React.cloneElement(child, { className: getStyles(children.length, i) })
  );

  return <div>{newChildren}</div>;
};
