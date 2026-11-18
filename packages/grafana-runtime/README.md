# Grafana Runtime library

> **@grafana/runtime is currently in BETA**.

This package allows access to grafana services. It requires Grafana to be running already and the functions to be imported as externals.

## Shortcuts in embedded content

Trusted app plugins can call `getEmbeddedKeybindings()` to subscribe to the
active Grafana shortcuts that support embedded content. Each snapshot includes
a revision, command IDs, key sequences in Mousetrap notation, and an
editable-field policy. The plugin is responsible for matching trusted user
keyboard input in its active embed and honoring the editable-field policy.
Pass the matched command ID and snapshot revision to `invoke`. Grafana
returns `false` if the snapshot is stale or the command is unavailable.
