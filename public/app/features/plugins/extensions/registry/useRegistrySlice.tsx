import { useMemo } from 'react';
import { useObservable } from 'react-use';

import {
  useAddedComponentsRegistry,
  useAddedFunctionsRegistry,
  useAddedLinksRegistry,
  useExposedComponentsRegistry,
} from '../ExtensionRegistriesContext';

import { AddedComponentRegistryItem } from './AddedComponentsRegistry';
import { AddedFunctionsRegistryItem } from './AddedFunctionsRegistry';
import { AddedLinkRegistryItem } from './AddedLinksRegistry';
import { ExposedComponentRegistryItem } from './ExposedComponentsRegistry';
import { Registry } from './Registry';

export function useAddedComponentsRegistrySlice<Props>(
  extensionPointId: string
): Array<AddedComponentRegistryItem<Props>> | undefined {
  const registry = useAddedComponentsRegistry();
  return useRegistrySlice(extensionPointId, registry);
}

export function useExposedComponentsRegistrySlice(
  extensionPointId: string
): ExposedComponentRegistryItem<{}> | undefined {
  const registry = useExposedComponentsRegistry();
  return useRegistrySlice(extensionPointId, registry);
}

export function useAddedLinksRegistrySlice(extensionPointId: string): AddedLinkRegistryItem[] | undefined {
  const registry = useAddedLinksRegistry();
  return useRegistrySlice(extensionPointId, registry);
}

export function useAddedFunctionsRegistrySlice(extensionPointId: string): AddedFunctionsRegistryItem[] | undefined {
  const registry = useAddedFunctionsRegistry();
  return useRegistrySlice(extensionPointId, registry);
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
