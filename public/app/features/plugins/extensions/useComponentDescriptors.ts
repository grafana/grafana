import { useDescriptorState } from './ComponentDescriptorsContext';

export function useComponentDescriptors(datasource?: string) {
  const { registry, ...status } = useDescriptorState();
  return { ...status, entries: registry?.list(datasource) ?? [] };
}

export function useComponentDescriptor(id: string) {
  const { registry, ...status } = useDescriptorState();
  return { ...status, entry: registry?.get(id) };
}
