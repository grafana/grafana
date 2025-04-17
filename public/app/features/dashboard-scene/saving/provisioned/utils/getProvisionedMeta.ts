import { config } from '@grafana/runtime';
import { folderAPI } from 'app/api/clients/folder';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

/**
 * Get k8s dashboard metadata based on the selected folder
 */
export async function getProvisionedMeta(folderUid?: string) {
  if (!folderUid || !config.featureToggles.provisioning) {
    return {};
  }
  const folderQuery = await dispatch(folderAPI.endpoints.getFolder.initiate({ name: folderUid })).unwrap();
  const repoName = folderQuery.metadata.annotations?.[AnnoKeyManagerIdentity];

  if (!repoName) {
    return {};
  }

  return {
    k8s: {
      annotations: {
        [AnnoKeyManagerIdentity]: repoName,
        [AnnoKeyManagerKind]: ManagerKind.Repo,
      },
    },
  };
}
