import { useMemo } from 'react';
import { useObservable } from 'react-use';

import {
  useAddedComponentsRegistry,
  useAddedFunctionsRegistry,
  useAddedLinksRegistry,
  useExposedComponentsRegistry,
} from '../ExtensionRegistriesContext';

import { type AddedComponentRegistryItem } from './AddedComponentsRegistry';
import { type AddedFunctionsRegistryItem } from './AddedFunctionsRegistry';
import { type AddedLinkRegistryItem } from './AddedLinksRegistry';
import { type ExposedComponentRegistryItem } from './ExposedComponentsRegistry';
import { type Registry } from './Registry';

export function useAddedComponentsRegistrySlice<Props>(
  extensionPointId: string
): Array<AddedComponentRegistryItem<Props>> | undefined {
  const registry = useAddedComponentsRegistry();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return useRegistrySlice(extensionPointId, registry) as Array<AddedComponentRegistryItem<Props>> | undefined;
}

export function useExposedComponentRegistrySlice<Props>(id: string): ExposedComponentRegistryItem<Props> | undefined {
  const registry = useExposedComponentsRegistry();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return useRegistrySlice(id, registry) as ExposedComponentRegistryItem<Props> | undefined;
}

export function useAddedLinksRegistrySlice(extensionPointId: string): AddedLinkRegistryItem[] | undefined {
  const registry = useAddedLinksRegistry();
  return useRegistrySlice(extensionPointId, registry);
}

export function useAddedFunctionsRegistrySlice<Signature>(
  extensionPointId: string
): Array<AddedFunctionsRegistryItem<Signature>> | undefined {
  const registry = useAddedFunctionsRegistry();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return useRegistrySlice(extensionPointId, registry) as Array<AddedFunctionsRegistryItem<Signature>> | undefined;
}

function useRegistrySlice<TRegistryValue extends object | unknown[] | Record<string | symbol, unknown>, TMapType>(
  extensionPointId: string,
  registry: Registry<TRegistryValue, TMapType>
): TRegistryValue | undefined {
  const observable = useMemo(() => {
    return registry.asObservableSlice((state) => state[extensionPointId]);
  }, [extensionPointId, registry]);

  return useObservable(observable);
}
