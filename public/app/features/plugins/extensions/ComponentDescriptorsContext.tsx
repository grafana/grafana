import { createContext, type PropsWithChildren, useContext } from 'react';
import { useAsyncRetry } from 'react-use';

import { loadComponentDescriptorRegistry } from './registry/componentDescriptorRegistry';

interface DescriptorState {
  registry?: Awaited<ReturnType<typeof loadComponentDescriptorRegistry>>;
  loading: boolean;
  error?: Error;
  retry: () => void;
}

const Context = createContext<DescriptorState | null>(null);

export function ComponentDescriptorsProvider({ children }: PropsWithChildren) {
  const { value: registry, loading, error, retry } = useAsyncRetry(loadComponentDescriptorRegistry, []);
  return <Context.Provider value={{ registry, loading, error, retry }}>{children}</Context.Provider>;
}

export function useDescriptorState() {
  const state = useContext(Context);
  if (!state) {
    throw new Error('ComponentDescriptorsProvider is missing');
  }
  return state;
}
