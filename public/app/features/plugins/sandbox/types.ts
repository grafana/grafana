import createVirtualEnvironment from '@locker/near-membrane-dom';

import { GrafanaPlugin } from '@grafana/data';

export type CompartmentDependencyModule = unknown;
export type PluginFactoryFunction = (...args: CompartmentDependencyModule[]) => SandboxedPluginObject;

export type SandboxedPluginObject = {
  plugin: GrafanaPlugin | Promise<GrafanaPlugin>;
};

export type SandboxEnvironment = ReturnType<typeof createVirtualEnvironment>;
