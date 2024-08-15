import { PropsWithChildren, createContext, useContext } from 'react';

import { AddedComponentsRegistry } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { AddedLinksRegistry } from 'app/features/plugins/extensions/registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from 'app/features/plugins/extensions/registry/ExposedComponentsRegistry';

export interface ExtensionRegistriesContextType {
  registries: {
    addedLinks: AddedLinksRegistry;
    addedComponents: AddedComponentsRegistry;
    exposedComponents: ExposedComponentsRegistry;
  };
}

// Using a different context for each registry to avoid unnecessary re-renders
export const AddedLinksRegistryContext = createContext<AddedLinksRegistry | undefined>(undefined);
export const AddedComponentsRegistryContext = createContext<AddedComponentsRegistry | undefined>(undefined);
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

export function useExposedComponentsRegistry(): ExposedComponentsRegistry {
  const context = useContext(ExposedComponentsRegistryContext);
  if (!context) {
    throw new Error('No `ExposedComponentsRegistryContext` found.');
  }
  return context;
}

export const ExtensionRegistriesProvider = ({
  registries,
  children,
}: PropsWithChildren<ExtensionRegistriesContextType>) => {
  return (
    <AddedLinksRegistryContext.Provider value={registries.addedLinks}>
      <AddedComponentsRegistryContext.Provider value={registries.addedComponents}>
        <ExposedComponentsRegistryContext.Provider value={registries.exposedComponents}>
          {children}
        </ExposedComponentsRegistryContext.Provider>
      </AddedComponentsRegistryContext.Provider>
    </AddedLinksRegistryContext.Provider>
  );
};
