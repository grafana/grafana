import { PluginExtension } from '@grafana/data';

import { AddedComponentRegistryItem } from './registry/AddedComponentsRegistry';
import { AddedLinkRegistryItem } from './registry/AddedLinksRegistry';
import { RegistryType } from './registry/Registry';

export type GetExtensions = ({
  context,
  extensionPointId,
  limitPerPlugin,
  addedLinksRegistry,
  addedComponentsRegistry,
}: {
  context?: object | Record<string | symbol, unknown>;
  extensionPointId: string;
  limitPerPlugin?: number;
  addedComponentsRegistry: RegistryType<AddedComponentRegistryItem[]> | undefined;
  addedLinksRegistry: RegistryType<AddedLinkRegistryItem[]> | undefined;
}) => { extensions: PluginExtension[] };

export type GetPluginExtensions<T = PluginExtension> = (options: {
  extensionPointId: string;
  // Make sure this object is properly memoized and not mutated.
  context?: object | Record<string | symbol, unknown>;
  limitPerPlugin?: number;
}) => { extensions: T[] };
