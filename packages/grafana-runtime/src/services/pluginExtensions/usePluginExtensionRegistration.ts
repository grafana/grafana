/** Identifies one declaration, using the same identity as the existing extension registries. */
export type PluginExtensionRegistrationTarget =
  | { kind: 'exposed-component'; id: string }
  | { kind: 'component' | 'link' | 'function'; pluginId: string; extensionPointId: string; title: string };

export type PluginExtensionRegistrationState =
  | { status: 'unknown' }
  | { status: 'absent' }
  | { status: 'declared' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'failed'; error: Error };

type UsePluginExtensionRegistration = (target: PluginExtensionRegistrationTarget) => PluginExtensionRegistrationState;
let singleton: UsePluginExtensionRegistration | undefined;

/** @internal */
export function setPluginExtensionRegistrationHook(hook: UsePluginExtensionRegistration): void {
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginExtensionRegistrationHook() can only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

/**
 * Observes an extension without loading its plugin or evaluating link configure callbacks.
 * `unknown` means metadata has not resolved; `declared` means the manifest advertises the
 * extension, not that its plugin is enabled. `ready` means registration succeeded, not that
 * the extension is visible or authorized in the current context. Use the existing extension
 * APIs to retrieve usable extensions, and gate presentation on plugin settings separately.
 *
 * Metadata follows Grafana's existing page-lifetime metadata cache. This hook does not refresh
 * settings, retry imports, debounce transitions, or retain a previous target's state.
 * @alpha
 */
export function usePluginExtensionRegistration(
  target: PluginExtensionRegistrationTarget
): PluginExtensionRegistrationState {
  if (!singleton) {
    throw new Error('usePluginExtensionRegistration() can only be used after Grafana has started.');
  }
  return singleton(target);
}
