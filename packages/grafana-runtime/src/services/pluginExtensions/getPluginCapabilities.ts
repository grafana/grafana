export type GetPluginCapability<T = Function> = (
  id: string,
  options?: {
    timeout?: number;
  }
) => Promise<T | null>;

let singleton: GetPluginCapability | undefined;

export function setPluginCapabilityGetter(instance: GetPluginCapability): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginCapabilityGetter() function should only be called once, when Grafana is starting.');
  }
  singleton = instance;
}

export function getPluginCapabilityGetter(): GetPluginCapability {
  if (!singleton) {
    throw new Error('getPluginCapabilityGetter() can only be used after the Grafana instance has started.');
  }
  return singleton;
}

export const getPluginCapability: GetPluginCapability = (id, options) => getPluginCapabilityGetter()(id, options);
