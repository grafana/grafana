/**
 * The kinds of Grafana resource that can be committed through the provisioning save flow.
 *
 * This is the single source of truth for the provisioning UI. To support a new k8s-style
 * resource (e.g. a library panel), add it here — the shared helpers (commit messages, request
 * errors, the edit form fields and request handler) all derive from this type and degrade to
 * generic behaviour for any value they don't special-case, so no parallel lists need updating.
 */
export type ProvisionedResourceType = 'dashboard' | 'folder' | 'playlist';
