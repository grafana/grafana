import { createContext, useContext } from 'react';

const OptionsPaneReadOnlyContext = createContext(false);

export const OptionsPaneReadOnlyProvider = OptionsPaneReadOnlyContext.Provider;

export function useOptionsPaneReadOnly(): boolean {
  return useContext(OptionsPaneReadOnlyContext);
}
