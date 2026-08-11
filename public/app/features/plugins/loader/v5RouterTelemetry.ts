import { createElement, type ComponentType } from 'react';

import { getLogger } from '@grafana/runtime/unstable';

// Plugin bundles are served from `public/plugins/<id>/` regardless of host (CDN, filesystem).
const PLUGIN_BUNDLE_PATH = /\/public\/plugins\/([^/]+)\//;

const reported = new Set<string>();

// React-router v5 APIs that are removed in v6.
const V5_ONLY_FUNCTIONS = ['useHistory', 'useRouteMatch', 'withRouter'] as const;
const V5_ONLY_COMPONENTS = ['Switch', 'Redirect', 'Prompt'] as const;

/**
 * Returns the react-router-dom module with the "v6 removed" exports wrapped so
 * we can report when a plugin uses them.
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

    if (isComponent(original)) {
      wrappers[exportName] = reportingComponent(exportName, original);
    }
  }

  const wrapped = { ...module, ...wrappers };

  // A spread copies enumerable properties only, and webpack marks `__esModule`
  // as non-enumerable. SystemJS reads it when it registers a shared dependency
  // and puts it on the namespace it hands to plugins, so carry it over by hand.
  copyHiddenProperty(module, wrapped, '__esModule');

  return wrapped;
}

/**
 * Reads the plugin id out of a captured stack.
 *
 * The shared dependency is a singleton, so a caller cannot be identified from
 * anything the loader holds. The wrapper captures its own stack instead, which
 * runs in the frame of the plugin that called it.
 *
 * Frame formats differ between browsers, so this matches on the bundle path
 * rather than on frame syntax. The first match is the nearest caller.
 */
export function getPluginIdFromStack(stack: string | undefined): string | undefined {
  if (!stack) {
    return undefined;
  }

  return stack.match(PLUGIN_BUNDLE_PATH)?.[1];
}

/**
 * Reports that a plugin used an export that react-router v6 removes.
 *
 * Faro does not collect a stack for a warning, so the caller cannot be
 * identified after the fact. The stack is captured here instead, in the frame
 * of the plugin that made the call.
 *
 * Reports once per plugin and export. When the plugin cannot be identified the
 * event still goes out, with the stack attached, because an unattributed signal
 * is more useful than none.
 */
export function reportV5Usage(exportName: string, stack: string | undefined = new Error().stack): void {
  const pluginId = getPluginIdFromStack(stack);
  // Without a plugin the key holds the export name alone. Keying on the stack
  // would let one export report many times, because React builds a different
  // stack on each render.
  const key = pluginId ? `${pluginId}:${exportName}` : `unattributed:${exportName}`;

  if (reported.has(key)) {
    return;
  }
  reported.add(key);

  getLogger('features.plugins').logWarning(
    'Plugin used a react-router-dom export that v6 removes',
    pluginId ? { pluginId, exportName } : { exportName, stack: stack ?? 'unavailable' }
  );
}

type UnknownFunction = (...args: never[]) => unknown;

function isFunction(value: unknown): value is UnknownFunction {
  return typeof value === 'function';
}

function reportingFunction(exportName: string, original: UnknownFunction): UnknownFunction {
  return function reportingWrapper(...args) {
    reportV5Usage(exportName);

    return original(...args);
  };
}

type UnknownProps = Record<string, unknown>;

function isComponent(value: unknown): value is ComponentType<UnknownProps> {
  return typeof value === 'function';
}

// The report happens during render rather than in an effect, so that a component
// which throws still reports. The dedupe keeps repeat renders quiet.
function reportingComponent(exportName: string, Original: ComponentType<UnknownProps>): UnknownFunction {
  return function ReportingWrapper(props: UnknownProps) {
    reportV5Usage(exportName);

    return createElement(Original, props);
  };
}

function copyHiddenProperty(source: object, target: object, key: string | symbol): void {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);

  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  }
}
