import { config } from '@grafana/runtime';
import { folderAPIv1beta1 as folderAPI } from 'app/api/clients/folder/v1beta1';
import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

export interface ProvisionedFolderMeta {
  /** The folder's own repository path, kept out of the k8s annotations where a source path means the dashboard's file */
  folderPath?: string;
  k8s?: {
    annotations?: {
      [AnnoKeyManagerIdentity]?: string;
      [AnnoKeyManagerKind]?: ManagerKind;
    };
  };
}

/**
 * Get k8s dashboard metadata based on the selected folder
 */
export async function getProvisionedMeta(folderUid?: string): Promise<ProvisionedFolderMeta> {
  if (!folderUid || !config.provisioningEnabled) {
    return {};
  }
  const folderQuery = await dispatch(folderAPI.endpoints.getFolder.initiate({ name: folderUid })).unwrap();
  const repoName = folderQuery.metadata.annotations?.[AnnoKeyManagerIdentity];

  if (!repoName) {
    return {};
  }

  return {
    folderPath: folderQuery.metadata.annotations?.[AnnoKeySourcePath],
    k8s: {
      annotations: {
        [AnnoKeyManagerIdentity]: repoName,
        [AnnoKeyManagerKind]: ManagerKind.Repo,
      },
    },
  };
}
