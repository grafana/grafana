import { getBackendSrv, config } from '@grafana/runtime';
import { Resource, ResourceClient, ResourceForCreate } from 'app/features/apiserver/types';
import { ScopedResourceClient } from 'app/features/apiserver/client';

export interface FolderAPI {
  createFolder(folder: Folder): Promise<FolderSpec>;
}

export interface Folder {
  title: string;
}

interface FolderSpec {
  uid: string;
  title: string;
}

// Implemented using /api/folders/*
class LegacyFolderAPI implements FolderAPI {
  constructor() {}

  async createFolder(folder: Folder): Promise<FolderSpec> {
    return getBackendSrv().post<FolderSpec>('/api/folders', folder)
  }
}

// Implemented using /apis/folders.grafana.app/*
class K8sFolderAPI implements FolderAPI {
  private client: ResourceClient<FolderSpec>;

  constructor() {
      this.client = new ScopedResourceClient<FolderSpec>({
      group: 'folder.grafana.app',
      version: 'v0alpha1',
      resource: 'folders',
      });
  }

  async createFolder(folder: Folder): Promise<FolderSpec> {
    const body = this.folderAsK8sResource(folder);
    return this.client.create(body).then((v) => this.asFolderSpec(v));
  }

  asFolderSpec(v: Resource<FolderSpec>): FolderSpec {
    return {
      uid: v.metadata.name,
      title: v.spec.title,
    };
  }

  folderAsK8sResource = (folder: Folder): ResourceForCreate<FolderSpec> => {
    return {
      metadata: {},
      spec: {
        title: folder.title,
        uid: '',
      },
    };
  };
}

let instance: FolderAPI | undefined = undefined;

export function getFolderAPI() {
  if (!instance) {
    instance = config.featureToggles.kubernetesFolders ? new K8sFolderAPI() : new LegacyFolderAPI();
  }
  return instance;
}
