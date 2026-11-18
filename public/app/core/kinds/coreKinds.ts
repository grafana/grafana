import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as PROVISIONING_API_GROUP } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import kbn from 'app/core/utils/kbn';
import { CONNECTIONS_URL, PROVISIONING_URL } from 'app/features/provisioning/constants';

import { GENERATED_KINDS } from './coreKinds.gen';
import { type KindInfo } from './types';

/**
 * Kinds Grafana serves itself, each described once: what it is called, which icon it gets and where
 * its pages are, so that every list of mixed kinds shows a kind the same way.
 *
 * A kind's API group, Kind and resource come from the app manifests compiled into this build
 * (`coreKinds.gen.ts`), where the manifest declares the kind. Only presentation lives here.
 *
 * The plural labels keep the translation keys they had before this table existed: a renamed key
 * would show untranslated until it is translated again.
 */
export const CORE_KINDS = {
  folder: {
    ...GENERATED_KINDS.folder.Folder,
    pluralLabel: () => t('provisioning.resource-kind.folders', 'Folders'),
    icon: 'folder',
    getRoute: (name: string) => `/dashboards/f/${encodeURIComponent(name)}`,
    listRoute: '/dashboards',
  },
  dashboard: {
    ...GENERATED_KINDS.dashboard.Dashboard,
    pluralLabel: () => t('provisioning.resource-kind.dashboards', 'Dashboards'),
    icon: 'apps',
    // The page path is /d/:uid/:slug?, so the title that makes the slug is optional too
    getRoute: (name: string, title?: string) => {
      const path = `/d/${encodeURIComponent(name)}`;
      return title === undefined ? path : `${path}/${kbn.slugifyForUrl(title)}`;
    },
    listRoute: '/dashboards',
  },
  playlist: {
    ...GENERATED_KINDS.playlist.Playlist,
    pluralLabel: () => t('provisioning.resource-kind.playlists', 'Playlists'),
    icon: 'presentation-play',
    // The edit page, not /playlists/play, which starts the fullscreen slideshow at once
    getRoute: (name: string) => `/playlists/edit/${encodeURIComponent(name)}`,
    listRoute: '/playlists',
  },
  // No `getRoute`: a library panel has no page of its own, only its row on the collection page.
  // Library panels are served from the dashboards group but are not a manifest kind, so this
  // identity is still written here.
  librarypanel: {
    group: DASHBOARD_API_GROUP,
    kind: 'LibraryPanel',
    resource: 'librarypanels',
    pluralLabel: () => t('provisioning.resource-kind.library-panels', 'Library panels'),
    icon: 'library-panel',
    listRoute: '/library-panels',
  },
  // The provisioning app's manifest declares no kinds yet, so these two stay written here.
  repository: {
    group: PROVISIONING_API_GROUP,
    kind: 'Repository',
    resource: 'repositories',
    pluralLabel: () => t('provisioning.resource-kind.repositories', 'Repositories'),
    icon: 'code-branch',
    getRoute: (name: string) => `${PROVISIONING_URL}/${encodeURIComponent(name)}`,
    listRoute: PROVISIONING_URL,
  },
  connection: {
    group: PROVISIONING_API_GROUP,
    kind: 'Connection',
    resource: 'connections',
    pluralLabel: () => t('provisioning.resource-kind.connections', 'Connections'),
    icon: 'plug',
    getRoute: (name: string) => `${CONNECTIONS_URL}/${encodeURIComponent(name)}/edit`,
    listRoute: CONNECTIONS_URL,
  },
  datasource: {
    // Not a served group but the storage collection the group of every data source plugin is
    // stored in: each plugin serves its own `{plugin}.datasource.grafana.app`
    group: 'datasource.grafana.app',
    collectionGroup: true,
    kind: 'DataSource',
    resource: 'datasources',
    pluralLabel: () => t('provisioning.resource-kind.datasources', 'Data sources'),
    icon: 'database',
    getRoute: (name: string) => `/connections/datasources/edit/${encodeURIComponent(name)}`,
    listRoute: '/connections/datasources',
  },
} as const satisfies Record<string, KindInfo>;
