# Observing extension registration

`usePluginExtensionRegistration` from `@grafana/runtime/unstable` observes one
extension without loading its plugin, invoking it, or running link `configure`
callbacks. Existing extension hooks retain their loading and filtering behavior.

```ts
const registration = usePluginExtensionRegistration({
  kind: 'component',
  pluginId: 'example-app',
  extensionPointId: 'grafana/extension-sidebar/v0-alpha',
  title: 'Example',
});
```

Added components, links, and functions are identified by kind, plugin ID,
extension point ID, and title. Exposed components use their existing ID:
`{ kind: 'exposed-component', id: 'example-app/component/v1' }`.

| Status     | Meaning                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `unknown`  | Metadata has not resolved for the observed target.                                                             |
| `absent`   | Neither metadata nor the runtime registry contains this extension.                                             |
| `declared` | Metadata declares it; its owner has not started loading.                                                       |
| `loading`  | The existing preloader or importer is loading its owner.                                                       |
| `ready`    | The corresponding registry has accepted the extension.                                                         |
| `failed`   | Metadata or owner loading failed, or loading completed without the declared registration. Includes an `Error`. |

Accepted registration takes precedence over the owner's load state: a different
extension from the same plugin might fail to register. Unrelated or undeclared
extensions do not inherit that plugin's loading state. A subsequent load attempt
is observed, but this API does not initiate retries.

Registration is not availability. Metadata can describe an installed but disabled
plugin, and registered links can be hidden by their contextual configuration.
Consumers must apply enabled settings, permissions, and contextual visibility
separately. In particular, do not show a placeholder solely because an extension
is declared. Continue using the existing extension APIs to obtain callable or
renderable extensions.

Metadata uses the existing page-lifetime cache; this API adds no settings refresh
mechanism. It reacts to registry and loader updates, unsubscribes on unmount, and
resets to `unknown` when its target changes. Presentation rules such as debounce,
stickiness, or recovery controls belong to the consumer.
