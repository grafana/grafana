import { config, getBackendSrv } from '@grafana/runtime';

import { Kind } from '../generated/kind/v1alpha1/kind_object_gen';
import { Spec } from '../generated/kind/v1alpha1/types.spec.gen';

export const GROUP = 'demomanifestapp.ext.grafana.app';
const VERSION = 'v1alpha1';
const PLURAL = 'kinds';

// On single-tenant Grafana this is "default"; on Grafana Cloud it is "stacks-<id>".
export function namespace() {
  return config.namespace || 'default';
}

// The namespaced group a Kind object's kind is served in.
export function declaredGroup(spec: Spec) {
  return `${spec.apiGroup}.${namespace()}.${GROUP}`;
}

function baseUrl() {
  return `/apis/${GROUP}/${VERSION}/namespaces/${namespace()}/${PLURAL}`;
}

export async function listKinds(): Promise<Kind[]> {
  const response = await getBackendSrv().get<{ items: Kind[] }>(baseUrl());
  return response.items ?? [];
}

export async function createKind(name: string, spec: Spec): Promise<Kind> {
  return getBackendSrv().post<Kind>(baseUrl(), {
    apiVersion: `${GROUP}/${VERSION}`,
    kind: 'Kind',
    metadata: { name, namespace: namespace() },
    spec,
  });
}

export async function updateKind(kind: Kind, spec: Spec): Promise<Kind> {
  return getBackendSrv().put<Kind>(`${baseUrl()}/${kind.metadata.name}`, { ...kind, spec });
}

export async function deleteKind(name: string): Promise<void> {
  await getBackendSrv().delete(`${baseUrl()}/${name}`);
}
