import React, { createContext, PropsWithChildren, useContext, useState } from 'react';
import { FieldValues } from 'react-hook-form';

export type WizardContextProps<T> = {
  currentPage: number;
  nextPage: () => void;
  prevPage: () => void;
  isLastPage: boolean;
  onSubmit: (data: T) => void;
  CurrentPageComponent: React.ComponentType;
};

export const WizardContext = createContext<WizardContextProps<FieldValues>>({
  currentPage: 0,
  nextPage: () => {},
  prevPage: () => {},
  isLastPage: true,
  onSubmit: () => {},
  CurrentPageComponent: () => null,
});

/**
 * Dependencies provided to Wizard component required to build WizardContext
 */
type WizardContextProviderDeps<T> = {
  pages: React.ComponentType[];
  onSubmit: (data: T) => void;
};

/**
 * Context providing current state and logic of a Wizard. Can be used by pages and navigation components.
 */
export function WizardContextProvider<T>(props: PropsWithChildren<WizardContextProviderDeps<T>>) {
  const [currentPage, setCurrentPage] = useState(0);
  const { pages, onSubmit, children } = props;

  const context: WizardContextProps<T> = {
    currentPage,
    CurrentPageComponent: pages[currentPage],
    isLastPage: currentPage === pages.length - 1,
    nextPage: () => setCurrentPage(currentPage + 1),
    prevPage: () => setCurrentPage(currentPage - 1),
    onSubmit,
  };

  // @ts-ignore
  return <WizardContext.Provider value={context}>{children}</WizardContext.Provider>;
}

export const useWizardContext = () => {
  return useContext(WizardContext);
};
