import saveAs from 'file-saver';

import { type Connection, type Repository } from 'app/api/clients/provisioning/v0alpha1';

const API_VERSION = 'provisioning.grafana.app/v0alpha1';

/**
 * Downloads a Repository or Connection as a JSON manifest matching the file-bootstrap format
 * (apiVersion/kind/metadata/spec). Status and manager annotations are stripped so the file can be
 * dropped straight into the provisioning manifests directory. Secret values are never exported.
 */
export function exportResourceAsJson(resource: Repository | Connection, kind: 'Repository' | 'Connection') {
  const manifest = {
    apiVersion: API_VERSION,
    kind,
    metadata: {
      name: resource.metadata?.name,
      namespace: resource.metadata?.namespace,
    },
    spec: resource.spec,
  };

  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  saveAs(blob, `${resource.metadata?.name ?? kind.toLowerCase()}.json`);
}
