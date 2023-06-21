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


// Annotation keys
const annoKeyCommitMessage = "grafana.com/commitMessage"
const annoKeyFolder = "grafana.com/folder"

export class DashboardKindService {
  private url: string;
  namespace: string;

  groupVersion = 'dashboard.kinds.grafana.com/v0-alpha'; // HARDCODED
  kind = 'Dashboard';
  name = 'dashboards';

  constructor() {
    this.namespace = contextSrv.user.orgId > 1 ? `org-${contextSrv.user.orgId}` : 'default';
    this.url = `/k8s/apis/${this.groupVersion}/namespaces/${this.namespace}/${this.name}`;
  }

  async get(name: string): Promise<Resource<Dashboard>> {
    return getBackendSrv().get<Resource<Dashboard>>(this.url + '/' + name);
  }

  async getHistory(name: string): Promise<any> {
    return getBackendSrv().get(this.url + '/' + name + '/history');
  }

  async getReferences(name: string): Promise<any> {
    return getBackendSrv().get(this.url + '/' + name + '/ref');
  }

  async save(cmd: SaveDashboardCommand): Promise<Resource<Dashboard>> {
    if (!cmd.dashboard.uid) {
      const res: Resource = {
        apiVersion: this.groupVersion,
        kind: this.kind,
        metadata: {
          generateName: 'uid', // will create a uid on the server side
          namespace: this.namespace,
          annotations: {
            [annoKeyFolder]: cmd.folderUid ?? '',
            [annoKeyCommitMessage]: cmd.message ?? '',
          },
        },
        spec: cmd.dashboard,
      };
      return getBackendSrv().post<Resource<Dashboard>>(this.url, res);
    }

    const old = await this.get(cmd.dashboard.uid);
    if (!old) {
      throw new Error('unable to find dashboard');
    }

    if (cmd.folderUid) {
        old.metadata.annotations[annoKeyFolder] = cmd.folderUid;
    }
    if (cmd.message) {
        old.metadata.annotations[annoKeyCommitMessage] = cmd.message;
    }
    old.spec = cmd.dashboard as any;

    let url = this.url + '/' + cmd.dashboard.uid;
    if (cmd.overwrite) {
        url += '?force=true'; // ???
    }
    return getBackendSrv().put<Resource<Dashboard>>(url, old);
  }
}

export const dashboardKindService = new DashboardKindService();
