import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { type Resource } from 'app/features/apiserver/types';

// The Notebook is a sibling resource of Dashboard, served from its own endpoint
// (dashboard.grafana.app/v2beta1/.../notebooks) rather than the dashboards path.
export function getK8sNotebookApiConfig() {
  return {
    group: 'dashboard.grafana.app',
    version: 'v2beta1',
    resource: 'notebooks',
  };
}

export class K8sNotebookAPI {
  private client: ScopedResourceClient<NotebookSpec>;

  constructor() {
    this.client = new ScopedResourceClient<NotebookSpec>(getK8sNotebookApiConfig());
  }

  getNotebook(name: string): Promise<Resource<NotebookSpec>> {
    return this.client.get(name);
  }
}
