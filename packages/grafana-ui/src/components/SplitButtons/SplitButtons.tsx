import React, { FC } from 'react';
// import { Button, LinkButton } from '../Forms/Button';

export interface SplitButtonsProps {
  children: any;
}

export const SplitButtons: FC<SplitButtonsProps> = ({ children }) => {
  const newChildren = React.cloneElement(children, {});

  return <div>{newChildren}</div>;
};
