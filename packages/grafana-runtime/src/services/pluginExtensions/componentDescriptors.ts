import { type ComponentDescriptor } from '@grafana/data';

type UseComponentDescriptors = (datasource?: string) => {
  entries: ComponentDescriptor[];
  loading: boolean;
  error?: Error;
  retry: () => void;
};

let useDescriptors: UseComponentDescriptors | undefined;

/** @internal */
export function setComponentDescriptorsHook(implementation: UseComponentDescriptors) {
  useDescriptors = implementation;
}

/** @alpha */
export function useComponentDescriptors(datasource?: string) {
  if (!useDescriptors) {
    throw new Error('The component descriptors hook must be initialized at startup.');
  }
  return useDescriptors(datasource);
}
