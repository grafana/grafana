import { getBackendSrv } from '@grafana/runtime';
import { BASE_URL } from 'app/api/clients/provisioning/baseAPI';
import { DashboardDTO } from 'app/types';

import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from '../apiserver/types';

/**
 *
 * Load a dashboard from repository
 */
export async function loadDashboardFromProvisioning(repo: string, path: string): Promise<DashboardDTO> {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref') ?? undefined; // commit hash or branch

  const url = `${BASE_URL}/repositories/${repo}/files/${path}`;
  return getBackendSrv()
    .get(url, ref ? { ref } : undefined)
    .then((v) => {
      // Load the results from dryRun
      const dryRun = v.resource.dryRun;
      if (!dryRun) {
        return Promise.reject('failed to read provisioned dashboard');
      }

      if (!dryRun.apiVersion.startsWith('dashboard.grafana.app')) {
        return Promise.reject('unexpected resource type: ' + dryRun.apiVersion);
      }

      // Make sure the annotation key exists
      let anno = dryRun.metadata.annotations;
      if (!anno) {
        dryRun.metadata.annotations = {};
      }
      anno[AnnoKeyManagerKind] = 'repo';
      anno[AnnoKeyManagerIdentity] = repo;
      anno[AnnoKeySourcePath] = ref ? path + '#' + ref : path;

      return {
        meta: {
          canStar: false,
          isSnapshot: false,
          canShare: false,

          // Should come from the repo settings
          canDelete: true,
          canSave: true,
          canEdit: true,

          // Includes additional k8s metadata
          k8s: dryRun.metadata,

          // lookup info
          provisioning: {
            file: url,
            ref: ref,
            repo: repo,
          },
        },
        dashboard: dryRun.spec,
      };
    });
}
