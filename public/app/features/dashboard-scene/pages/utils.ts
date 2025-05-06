import { updateNavIndex } from 'app/core/actions';
import { backendSrv } from 'app/core/services/backend_srv';
import { buildNavModel } from 'app/features/folders/state/navModel';
import { store } from 'app/store/store';

export async function updateNavModel(folderUid: string) {
  try {
    const folder = await backendSrv.getFolderByUid(folderUid);
    store.dispatch(updateNavIndex(buildNavModel(folder)));
  } catch (err) {
    console.warn('Error fetching parent folder', folderUid, 'for dashboard', err);
  }
}

export function getEmptyDashboard() {
  return {
    dashboard: {
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: {
              type: 'grafana',
              uid: '-- Grafana --',
            },
            enable: false,
            hide: true,
            iconColor: '',
            name: '',
            type: 'dashboard',
          },
        ],
      },
      description: '',
      editable: true,
      graphTooltip: 1,
      id: null,
      panels: [
        {
          gridPos: {
            h: 1,
            w: 10,
            x: 0,
            y: 0,
          },
          title: 'Loading dashboard...',
          type: 'row',
        },
      ],
      schemaVersion: 38,
      timepicker: {},
      title: '',
      uid: 'a.acl',
      version: 0,
    },
    meta: {
      annotationsPermissions: {
        dashboard: {
          canAdd: false,
          canDelete: false,
          canEdit: false,
        },
        organization: {
          canAdd: false,
          canDelete: false,
          canEdit: false,
        },
      },
      canAdmin: false,
      canDelete: false,
      canEdit: false,
      canSave: false,
      canStar: false,
      created: '2025-04-22T14:10:44Z',
      createdBy: 'automon',
      expires: '2025-04-23T14:10:44Z',
      hasAcl: false,
      isFolder: false,
      provisioned: false,
      provisionedExternalId: '',
      reloadOnParamsChange: true,
      slug: '',
      type: 'db',
      updated: '2025-04-22T14:10:44Z',
      updatedBy: 'automon',
      url: '/d/a.acl/',
      version: 0,
    },
  };
}
