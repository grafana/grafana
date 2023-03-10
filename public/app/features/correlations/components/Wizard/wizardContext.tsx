import React, { createContext, PropsWithChildren, useContext, useState } from 'react';
import { FieldValues } from 'react-hook-form';

export type WizardContextProps = {
  currentPage: number;
  nextPage: () => void;
  prevPage: () => void;
  isLastPage: boolean;
  onSubmit: (data: FieldValues) => void;
  CurrentPageComponent: React.ComponentType;
};

export const WizardContext = createContext<WizardContextProps>({
  currentPage: 0,
  nextPage: () => {},
  prevPage: () => {},
  isLastPage: true,
  onSubmit: () => {},
  CurrentPageComponent: () => null,
});

type WizardContextProviderProps = {
  pages: React.ComponentType[];
  onSubmit: (data: FieldValues) => void;
};

export function WizardContextProvider(props: PropsWithChildren<WizardContextProviderProps>) {
  const [currentPage, setCurrentPage] = useState(0);
  const { pages, onSubmit, children } = props;

  const context: WizardContextProps = {
    currentPage,
    CurrentPageComponent: pages[currentPage],
    isLastPage: currentPage === pages.length - 1,
    nextPage: () => setCurrentPage(currentPage + 1),
    prevPage: () => setCurrentPage(currentPage - 1),
    onSubmit,
  };

  return <WizardContext.Provider value={context}>{children}</WizardContext.Provider>;
}

export const useWizardContext = () => {
  return useContext(WizardContext);
};
