import memoizeOne from 'memoize-one';
import { useEffect, useState } from 'react';

import { PanelModel } from '@grafana/data';
import { Spec as DashboardV2Spec, LibraryPanelKind, PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { AnnoKeyFolder, AnnoKeyFolderTitle } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardV2Resource, isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { DashboardDTO } from 'app/types/dashboard';

import { DashboardModel } from '../../../../dashboard/state/DashboardModel';

export interface UnifiedDashboardDTO {
  panels: Array<{
    id: number;
    title: string;
    type: string;
    collapsed?: boolean;
    libraryPanel?: {
      name: string;
      uid: string;
    };
    // this is only used for v1 dashboards, because in v2 there is not concept of panel.panels,
    // and rows are determined by the layout mode
    rows?: PanelModel[];
  }>;
  title: string;
  uid: string;
  folderTitle: string;
  folderUid: string;
}

const convertV1ToUnifiedDashboardDTO = memoizeOne((dashboardDTO: DashboardDTO) => {
  // RTKQuery freezes all returned objects. DashboardModel constructor runs migrations which might change the internal object
  // Hence we need to add structuredClone to make a deep copy of the API response object
  const { dashboard, meta } = structuredClone(dashboardDTO);
  const model = new DashboardModel(dashboard, meta);

  const unifiedDashboard: UnifiedDashboardDTO = {
    panels: model.panels.map((panel) => ({
      id: panel.id,
      title: panel.title,
      type: panel.type,
      collapsed: Boolean(panel.collapsed),
      rows: panel.panels,
      ...(panel.libraryPanel && {
        libraryPanel: {
          name: panel.libraryPanel.name ?? '',
          uid: panel.libraryPanel.uid ?? '',
        },
      }),
    })),
    title: model.title,
    uid: model.uid,
    folderTitle: model.meta.folderTitle ?? '',
    folderUid: model.meta.folderUid ?? '',
  };

  return unifiedDashboard;
});

const mapV2ElementsToPanels = (elements: Array<PanelKind | LibraryPanelKind>) =>
  elements.map((element) => ({
    id: element.spec.id,
    title: element.spec.title,
    type: element.kind === 'Panel' ? element.spec.vizConfig.group : 'LibraryPanel',
    ...(element.kind === 'LibraryPanel' && {
      libraryPanel: {
        name: element.spec.libraryPanel.name ?? '',
        uid: element.spec.libraryPanel.uid ?? '',
      },
    }),
  }));

const convertV2ToUnifiedDashboardDTO = (
  dashboardDTO: DashboardWithAccessInfo<DashboardV2Spec> | DashboardDTO
): UnifiedDashboardDTO => {
  // v1 api can return a v2 dashboard as a dashboardDTO, so we need to check if the dashboard is a v2 spec
  if ('dashboard' in dashboardDTO && isDashboardV2Spec(dashboardDTO.dashboard)) {
    return {
      panels: mapV2ElementsToPanels(Object.values(dashboardDTO.dashboard.elements)),
      title: dashboardDTO.dashboard.title,
      uid: dashboardDTO.dashboard.uid,
      folderTitle: dashboardDTO.meta.folderTitle ?? '',
      folderUid: dashboardDTO.meta.folderUid ?? '',
    };
  }

  // v2 api returns a v2 resource
  if (isDashboardV2Resource(dashboardDTO)) {
    return {
      panels: mapV2ElementsToPanels(Object.values(dashboardDTO.spec.elements)),
      title: dashboardDTO.spec.title,
      uid: dashboardDTO.metadata.name,
      folderTitle: dashboardDTO.metadata.annotations?.[AnnoKeyFolderTitle] ?? '',
      folderUid: dashboardDTO.metadata.annotations?.[AnnoKeyFolder] ?? '',
    };
  }

  // This should never be reached due to caller's type guards, but TypeScript requires it
  // Return a minimal valid object to satisfy the return type
  return {
    panels: [],
    title: '',
    uid: '',
    folderTitle: '',
    folderUid: '',
  };
};

export function useDashboardQuery(dashboardUid?: string) {
  const [dashboard, setDashboard] = useState<UnifiedDashboardDTO>();
  const [isFetching, setIsFetching] = useState(false);
  useEffect(() => {
    if (dashboardUid) {
      setIsFetching(true);
      getDashboardAPI()
        .getDashboardDTO(dashboardUid)
        .then((dashboardDTO) => {
          if ('dashboard' in dashboardDTO) {
            if (isDashboardV2Spec(dashboardDTO.dashboard)) {
              setDashboard(convertV2ToUnifiedDashboardDTO(dashboardDTO));
            } else {
              setDashboard(convertV1ToUnifiedDashboardDTO(dashboardDTO));
            }
          } else if (isDashboardV2Resource(dashboardDTO)) {
            setDashboard(convertV2ToUnifiedDashboardDTO(dashboardDTO));
          } else {
            console.error('Something went wrong, unexpected dashboard format');
          }
          setIsFetching(false);
        });
    }
  }, [dashboardUid]);

  return { dashboard, isFetching };
}
