import { createElement, type ComponentType } from 'react';

import { getLogger } from '@grafana/runtime/unstable';

import { isReactComponent } from '../extensions/validators';

// Plugin bundles are served with `public/plugins/<id>/` regardless of host (CDN, filesystem).
const PLUGIN_BUNDLE_PATH = /\/public\/plugins\/([^/]+)\//;
const reported = new Set<string>();
// React-router v5 APIs that are removed in v6.
const V5_ONLY_FUNCTIONS = ['useHistory', 'useRouteMatch', 'withRouter'] as const;
const V5_ONLY_COMPONENTS = ['Switch', 'Redirect', 'Prompt'] as const;

type UnknownFunction = (...args: never[]) => unknown;
type UnknownProps = Record<string, unknown>;

/**
 * Returns the react-router-dom module with the v5 APIs wrapped in functions that report usage to Faro.
 */
export function withV5UsageTelemetry<T extends Record<string, unknown>>(module: T): T {
  const wrappers: Record<string, UnknownFunction> = {};

  for (const exportName of V5_ONLY_FUNCTIONS) {
    const original = module[exportName];

    if (isFunction(original)) {
      wrappers[exportName] = reportingFunction(exportName, original);
    }
  }

  for (const exportName of V5_ONLY_COMPONENTS) {
    const original = module[exportName];

    if (isReactComponent(original)) {
      wrappers[exportName] = reportingComponent(exportName, original);
    }
  }

  const wrapped = { ...module, ...wrappers };

  // Webpack defines `__esModule` as non-enumerable, which makes the spread drop it,
  // but SystemJS relies on it to determine whether to use the default export.
  const esModule = Object.getOwnPropertyDescriptor(module, '__esModule');

  if (esModule) {
    Object.defineProperty(wrapped, '__esModule', esModule);
  }

  return wrapped;
}

export function getPluginIdFromStack(stack: string | undefined): string | undefined {
  if (!stack) {
    return undefined;
  }

  return stack.match(PLUGIN_BUNDLE_PATH)?.[1];
}

/**
 * Reports once per plugin and export. When the plugin cannot be identified the
 * event still reports but without the plugin id.
 */
export function reportV5Usage(exportName: string, stack?: string): void {
  const pluginId = getPluginIdFromStack(stack);
  const key = pluginId ? `${pluginId}:${exportName}` : `unknownPluginId:${exportName}`;

  if (reported.has(key)) {
    return;
  }
  reported.add(key);

  getLogger('features.plugins').logWarning(
    'Plugin used a react-router-dom export that v6 removes',
    pluginId ? { pluginId, exportName } : { exportName, stack: stack ?? 'unavailable' }
  );
}

function isFunction(value: unknown): value is UnknownFunction {
  return typeof value === 'function';
}

// Functions are called by the plugin, so the plugin is on the stack.
function reportingFunction(exportName: string, original: UnknownFunction): UnknownFunction {
  return function reportingWrapper(...args) {
    reportV5Usage(exportName, new Error().stack);

    return original(...args);
  };
}

// Components are called by React, so the plugin that rendered it is not on the stack.
function reportingComponent(exportName: string, Original: ComponentType<UnknownProps>): UnknownFunction {
  return function ReportingWrapper(props: UnknownProps) {
    reportV5Usage(exportName);

    return createElement(Original, props);
  };
}
