import { logInfo } from '@grafana/runtime';

const cachedMetricProxies = new WeakMap<object, unknown>();
const trackedKeys: Record<string, boolean> = {};

let pluginNameFromUrlRegex = /plugins\/([^/]*)\/.*?module\.js/i;

/**
 * This function attempts to determine the plugin name by
 * analyzing the stack trace. It achieves this by generating
 * an error object and accessing its stack property,
 * which typically includes the script URL.
 *
 * Note that when inside an async function of any kind, the
 * stack trace is somewhat lost and the plugin name cannot
 * be determined most of the times.
 *
 * It assumes that the plugin ID is part of the URL,
 * although this cannot be guaranteed.
 *
 * Please note that this function is specifically designed
 * for plugins loaded with systemjs.
 *
 * It is important to treat the information provided by
 * this function as a "best guess" and not rely on it
 * for any business logic.
 */
function guessPluginNameFromStack(): string | undefined {
  try {
    const errorStack = new Error().stack;
    if (errorStack?.includes('systemJSPrototype')) {
      return undefined;
    }
    if (errorStack && errorStack.includes('module.js')) {
      let match = errorStack.match(pluginNameFromUrlRegex);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (e) {
    return undefined;
  }
  return undefined;
}

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
        const pluginName = guessPluginNameFromStack() ?? '';
        const accessPath = `${parentName}.${String(key)}`;

        // we want to report API usage per-plugin when possible
        const cacheKey = `${pluginName}:${accessPath}`;

        if (!trackedKeys[cacheKey]) {
          trackedKeys[cacheKey] = true;
          // note: intentionally not using shorthand property assignment
          // so any future variable name changes won't affect the metrics names
          logInfo(`Plugin using ${accessPath}`, {
            key: String(key),
            parent: parentName,
            packageName: packageName,
            guessedPluginName: pluginName,
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
