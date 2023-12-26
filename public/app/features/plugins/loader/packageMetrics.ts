import { logInfo } from '@grafana/runtime';

const cachedMetricProxies = new WeakMap<object, unknown>();
const trackedKeys: Record<string, boolean> = {};

function createMetricsProxy<T extends object>(obj: T, parentName: string, packageName: string): T {
  const handler: ProxyHandler<T> = {
    get(target, key) {
      if (
        // plugins are evaluated by SystemJS and not by a browser <script> tag
        // if document.currentScript is null this is most likely called by a plugin
        document.currentScript === null &&
        typeof key !== 'symbol' &&
        // __useDefault is a implementation detail of our systemjs plugins
        // that we don't want to track
        key.toString() !== '__useDefault'
      ) {
        const accessPath = `${parentName}.${String(key)}`;

        // we want to report API usage per-plugin when possible
        const cacheKey = `${accessPath}`;

        if (!trackedKeys[cacheKey]) {
          trackedKeys[cacheKey] = true;
          // note: intentionally not using shorthand property assignment
          // so any future variable name changes won't affect the metrics names
          logInfo(`Plugin using ${accessPath}`, {
            key: String(key),
            parent: parentName,
            packageName: packageName,
          });
        }
      }

      let value = Reflect.get(target, key);

      if (value !== null && typeof value === 'object' && !(value instanceof RegExp)) {
        if (!cachedMetricProxies.has(value)) {
          cachedMetricProxies.set(value, createMetricsProxy(value, `${parentName}.${String(key)}`, packageName));
        }
        return cachedMetricProxies.get(value);
      }

      // proxies don't play nice with functions scopes
      if (typeof value === 'function') {
        value = value.bind(target);
      }
      return value;
    },
  };

  if (typeof obj === 'object' && obj !== null) {
    return new Proxy(obj, handler);
  }

  return obj;
}

const trackPackagesRe = /^(@grafana|app\/)/;

export function trackPackageUsage<T extends object>(obj: T, packageName: string): T {
  if (trackPackagesRe.test(packageName)) {
    return createMetricsProxy(obj, packageName, packageName);
  }
  return obj;
}
