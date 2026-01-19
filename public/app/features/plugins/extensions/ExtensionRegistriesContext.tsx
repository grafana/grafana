import { PropsWithChildren, createContext, useContext } from 'react';
import { useAsync } from 'react-use';

import { AddedComponentsRegistry } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from 'app/features/plugins/extensions/registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from 'app/features/plugins/extensions/registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from 'app/features/plugins/extensions/registry/ExposedComponentsRegistry';

import { getPluginExtensionRegistries } from './registry/setup';

// Using a different context for each registry to avoid unnecessary re-renders
export const AddedLinksRegistryContext = createContext<AddedLinksRegistry | undefined>(undefined);
export const AddedComponentsRegistryContext = createContext<AddedComponentsRegistry | undefined>(undefined);
export const AddedFunctionsRegistryContext = createContext<AddedFunctionsRegistry | undefined>(undefined);
export const ExposedComponentsRegistryContext = createContext<ExposedComponentsRegistry | undefined>(undefined);

export function useAddedLinksRegistry(): AddedLinksRegistry {
  const context = useContext(AddedLinksRegistryContext);
  if (!context) {
    throw new Error('No `AddedLinksRegistryContext` found.');
  }
  return context;
}

export function useAddedComponentsRegistry(): AddedComponentsRegistry {
  const context = useContext(AddedComponentsRegistryContext);
  if (!context) {
    throw new Error('No `AddedComponentsRegistryContext` found.');
  }
  return context;
}

export function useAddedFunctionsRegistry(): AddedFunctionsRegistry {
  const context = useContext(AddedFunctionsRegistryContext);
  if (!context) {
    throw new Error('No `AddedFunctionsRegistry` found.');
  }
  return context;
}

export function useExposedComponentsRegistry(): ExposedComponentsRegistry {
  const context = useContext(ExposedComponentsRegistryContext);
  if (!context) {
    throw new Error('No `ExposedComponentsRegistryContext` found.');
  }
  return context;
}

export const ExtensionRegistriesProvider = ({ children }: PropsWithChildren) => {
  const { loading, value: registries } = useAsync(() => getPluginExtensionRegistries());

  if (loading || !registries) {
    return null;
  }

  return (
    <AddedLinksRegistryContext.Provider value={registries.addedLinksRegistry}>
      <AddedComponentsRegistryContext.Provider value={registries.addedComponentsRegistry}>
        <AddedFunctionsRegistryContext.Provider value={registries.addedFunctionsRegistry}>
          <ExposedComponentsRegistryContext.Provider value={registries.exposedComponentsRegistry}>
            {children}
          </ExposedComponentsRegistryContext.Provider>
        </AddedFunctionsRegistryContext.Provider>
      </AddedComponentsRegistryContext.Provider>
    </AddedLinksRegistryContext.Provider>
  );
};
