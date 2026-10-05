import { type PluginExtension } from '@grafana/data';

import { type AddedComponentRegistryItem } from './registry/AddedComponentsRegistry';
import { type AddedFunctionsRegistryItem } from './registry/AddedFunctionsRegistry';
import { type AddedLinkRegistryItem } from './registry/AddedLinksRegistry';
import { type RegistryType } from './registry/Registry';

export type GetExtensionsOptions = {
  context?: object | Record<string | symbol, unknown>;
  extensionPointId: string;
  limitPerPlugin?: number;
  addedComponentsRegistry: RegistryType<AddedComponentRegistryItem[]> | undefined;
  addedLinksRegistry: RegistryType<AddedLinkRegistryItem[]> | undefined;
  addedFunctionsRegistry: RegistryType<AddedFunctionsRegistryItem[]> | undefined;
};

export type GetExtensions = (options: GetExtensionsOptions) => { extensions: PluginExtension[] };
