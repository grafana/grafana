import { PropsWithChildren, createContext, useContext } from 'react';

import { AddedComponentsRegistry } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from 'app/features/plugins/extensions/registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from 'app/features/plugins/extensions/registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from 'app/features/plugins/extensions/registry/ExposedComponentsRegistry';
import { UrlRecognizersRegistry } from 'app/features/plugins/extensions/registry/UrlRecognizersRegistry';

import { PluginExtensionRegistries } from './registry/types';

export interface ExtensionRegistriesContextType {
  registries: PluginExtensionRegistries;
}

// Using a different context for each registry to avoid unnecessary re-renders
export const AddedLinksRegistryContext = createContext<AddedLinksRegistry | undefined>(undefined);
export const AddedComponentsRegistryContext = createContext<AddedComponentsRegistry | undefined>(undefined);
export const AddedFunctionsRegistryContext = createContext<AddedFunctionsRegistry | undefined>(undefined);
export const ExposedComponentsRegistryContext = createContext<ExposedComponentsRegistry | undefined>(undefined);
export const UrlRecognizersRegistryContext = createContext<UrlRecognizersRegistry | undefined>(undefined);

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

export function useUrlRecognizersRegistry(): UrlRecognizersRegistry {
  const context = useContext(UrlRecognizersRegistryContext);
  if (!context) {
    throw new Error('No `UrlRecognizersRegistryContext` found.');
  }
  return context;
}

export const ExtensionRegistriesProvider = ({
  registries,
  children,
}: PropsWithChildren<ExtensionRegistriesContextType>) => {
  return (
    <AddedLinksRegistryContext.Provider value={registries.addedLinksRegistry}>
      <AddedComponentsRegistryContext.Provider value={registries.addedComponentsRegistry}>
        <AddedFunctionsRegistryContext.Provider value={registries.addedFunctionsRegistry}>
          <ExposedComponentsRegistryContext.Provider value={registries.exposedComponentsRegistry}>
            <UrlRecognizersRegistryContext.Provider value={registries.urlRecognizersRegistry}>
              {children}
            </UrlRecognizersRegistryContext.Provider>
          </ExposedComponentsRegistryContext.Provider>
        </AddedFunctionsRegistryContext.Provider>
      </AddedComponentsRegistryContext.Provider>
    </AddedLinksRegistryContext.Provider>
  );
};
