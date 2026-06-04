/**
 * The kind of Grafana resource being committed through the provisioning save flow.
 *
 * This is an open string type: the listed values are the ones with bespoke behaviour today (and
 * power editor autocomplete), but any other value is accepted. The shared helpers (commit messages,
 * request errors, the edit form fields and request handler) all degrade to generic behaviour for
 * values they don't special-case, so a new k8s-style resource (e.g. a library panel) can pass its
 * own type without this list — or any other shared code — needing to change.
 */
export type ProvisionedResourceType = 'dashboard' | 'folder' | 'playlist' | (string & {});
