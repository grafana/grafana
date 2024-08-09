import { createContext } from 'react';

export type SchemaType = Record<string, any> | undefined;
export type ResourceInfo = {
  group: string;
  version: string;
  resource: string;
  namespaced: boolean;
};

export const SchemaContext = createContext<SchemaType>(undefined);
export const NamespaceContext = createContext<string | undefined>(undefined);

// This should only be valid when inside a
export const ResourceContext = createContext<ResourceInfo | undefined>(undefined);
