import * as React from 'react';
import { useState } from 'react';

import { ConfirmModalProps } from '../ConfirmModal/ConfirmModal';

type ConfirmContentType = Omit<ConfirmModalProps, 'isOpen' | 'icon'>;

interface Context {
  confirmContent?: ConfirmContentType;
  setConfirmContent?: (t: ConfirmContentType | undefined) => void;
}

const DrawerContext = React.createContext<Context | undefined>(undefined);

type Props = Context & React.PropsWithChildren;

const DrawerProvider = ({ children }: Props) => {
  const [confirmContent, setConfirmContent] = useState<ConfirmContentType | undefined>();

  const value: Context = {
    confirmContent,
    setConfirmContent,
  };

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};

const useDrawerContext = () => {
  const context = React.useContext(DrawerContext);

  if (context === undefined) {
    throw new Error('useDrawerContext must be used within a DrawerContext');
  }

  return context;
};

export { DrawerProvider, useDrawerContext };
