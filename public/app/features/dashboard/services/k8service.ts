import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

export interface Resource<T = any> {
  apiVersion: string; //'dashboard.kinds.grafana.com/v0.0-alpha',
  kind: string; //'Dashboard',
  metadata: {
    namespace: string;
    name?: string;
    generateName?: string;
    resourceVersion?: string;
    annotations: Record<string, string>;
  };
  spec: T;
}

export class KindService<T = any> {
  private url: string;
  namespace: string;

  groupVersion = 'dashboard.kinds.grafana.com/v0.0-alpha';
  kind = 'Dashboard';
  name = 'dashboards';

  constructor() {
    this.namespace = contextSrv.user.orgId > 1 ? `org-${contextSrv.user.orgId}` : 'default';
    this.url = `/k8s/apis/${this.groupVersion}/namespaces/${this.namespace}/${this.name}`;
  }

  async get(name: string): Promise<Resource<T>> {
    return getBackendSrv().get<Resource<T>>(this.url + '/' + name);
  }

  async save(cmd: SaveDashboardCommand): Promise<Resource<T>> {
    if (!cmd.dashboard.uid) {
      const res: Resource = {
        apiVersion: this.groupVersion,
        kind: this.kind,
        metadata: {
          generateName: 'uid',
          namespace: this.namespace,
          annotations: {
            'grafana.com/folder': cmd.folderUid ?? '',
            'grafana.com/commitMessage': cmd.message ?? '',
          },
        },
        spec: cmd.dashboard,
      };
      return getBackendSrv().post<Resource<T>>(this.url, res);
    }

    const old = await this.get(cmd.dashboard.uid);
    if (!old) {
      throw new Error('unable to find dashboard');
    }

    // old.metadata.annotations['grafana.com/folder'] = cmd.folderUid ?? '';
    // old.metadata.annotations['grafana.com/commitMessage'] = cmd.message ?? '';
    old.spec = cmd.dashboard as any;

    if (false) {
      return lastValueFrom(
        getBackendSrv().fetch<Resource<T>>({
          url: this.url + '/' + cmd.dashboard.uid + '?fieldManager=grafana&fieldValidation=Ignore',
          method: 'PATCH',
          data: old,
          headers: {
            'content-type': 'application/merge-patch+json',
          },
        })
      ).then((v) => {
        console.log('k8s? patch?', v);
        return v.data;
      });
    }

    return getBackendSrv().put<Resource<T>>(this.url + '/' + cmd.dashboard.uid, old);
  }
}

export const dashboardKindService = new KindService<Dashboard>();
