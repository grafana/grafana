import { type ComponentDescriptor, type ComponentHostAdapter } from '@grafana/data';

interface ComponentDescriptorHooks {
  list: (datasource?: string) => {
    entries: ComponentDescriptor[];
    loading: boolean;
    error?: Error;
    retry: () => void;
  };
  register: (adapter: ComponentHostAdapter) => void;
}

let hooks: ComponentDescriptorHooks | undefined;

/** @internal */
export function setComponentDescriptorHooks(implementation: ComponentDescriptorHooks) {
  hooks = implementation;
}

/** @alpha */
export function useComponentDescriptors(datasource?: string) {
  if (!hooks) {
    throw new Error('Component descriptor hooks must be initialized at startup.');
  }
  return hooks.list(datasource);
}

/** @alpha */
export function useRegisterComponentHostAdapter(adapter: ComponentHostAdapter) {
  if (!hooks) {
    throw new Error('Component descriptor hooks must be initialized at startup.');
  }
  hooks.register(adapter);
}
