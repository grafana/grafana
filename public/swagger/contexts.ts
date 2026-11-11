import { createContext } from 'react';

export type ResourceInfo = {
  group: string;
  version: string;
  resource: string;
  namespaced: boolean;
};

export const NamespaceContext = createContext<string | undefined>(undefined);
export const ResourceContext = createContext<ResourceInfo | undefined>(undefined);
