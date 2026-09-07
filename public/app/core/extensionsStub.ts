// OSS stand-in for the enterprise frontend entry point.
//
// `app/extensions` is aliased by webpack: to the enterprise checkout when one is
// present, otherwise to this file. Grafana core calls these two hooks
// unconditionally during boot (see app.ts), so the OSS build needs real no-ops
// rather than an absent module.

export function addExtensionReducers(): void {}

export function init(): void {}
