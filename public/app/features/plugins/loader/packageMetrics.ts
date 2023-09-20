import { logInfo } from '@grafana/runtime';

const cachedMetricProxies = new WeakMap<object, unknown>();
const trackedKeys: Record<string, boolean> = {};

function createMetricsProxy<T extends object>(obj: T, parentName: string, packageName: string): T {
  const handler: ProxyHandler<T> = {
    get(target, key) {
      if (typeof key !== 'symbol' || key.toString() === '__useDefault') {
        const fullKey = `${parentName}.${String(key)}`;
        if (!trackedKeys[fullKey]) {
          trackedKeys[fullKey] = true;
          logInfo(`Plugin using ${fullKey}`, {
            key: String(key),
            parent: parentName,
            packageName,
          });
        }
      }

      // typescript will not trust the key is a key of target, but given this is a proxy handler
      // it is guarantee that `key` is a key of `target` so we can type assert to make types work
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const value = target[key as keyof T];

      if (value !== null && typeof value === 'object') {
        if (!cachedMetricProxies.has(value)) {
          cachedMetricProxies.set(value, createMetricsProxy(value, `${parentName}.${String(key)}`, packageName));
        }
        return cachedMetricProxies.get(value);
      }
      return value;
    },
  };

  if (typeof obj === 'object' && obj !== null) {
    return new Proxy(obj, handler);
  }

  return obj;
}

export function trackPackageUsage<T extends object>(obj: T, packageName: string): T {
  return createMetricsProxy(obj, packageName, packageName);
}
