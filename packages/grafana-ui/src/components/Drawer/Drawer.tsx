import React, { FC, ReactNode } from 'react';
import RcDrawer from 'rc-drawer';

interface Props {
  title: string;
  children: ReactNode;

  onClose: () => void;
}

export const Drawer: FC<Props> = ({ children, onClose, title }) => {
  return (
    <RcDrawer onClose={onClose} handler={false} open={true} maskClosable={true}>
      <div>{title}</div>
      {children}
    </RcDrawer>
  );
};
