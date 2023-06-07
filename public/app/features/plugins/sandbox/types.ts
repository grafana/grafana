import { GrafanaPlugin } from '@grafana/data';

export type CompartmentDependencyModule = unknown;
export type PluginFactoryFunction = (...args: CompartmentDependencyModule[]) => SandboxedPluginObject;

export type SandboxedPluginObject = {
  plugin: GrafanaPlugin | Promise<GrafanaPlugin>;
};
