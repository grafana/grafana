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
    })),
    title: model.title,
    uid: model.uid,
    folderTitle: model.meta.folderTitle ?? '',
    folderUid: model.meta.folderUid ?? '',
  };

  return unifiedDashboard;
});

const convertV2ToUnifiedDashboardDTO = (dashboardDTO: DashboardWithAccessInfo<DashboardV2Spec> | DashboardDTO) => {
  let unifiedDashboard: UnifiedDashboardDTO;
  if ('dashboard' in dashboardDTO && isDashboardV2Spec(dashboardDTO.dashboard)) {
    const elements = Object.values(dashboardDTO.dashboard.elements);
    unifiedDashboard = {
      panels: elements.map((element: PanelKind | LibraryPanelKind) => ({
        id: element.spec.id,
        title: element.spec.title,
        type: element.kind === 'Panel' ? element.spec.vizConfig.group : 'LibraryPanel',
      })),
      title: dashboardDTO.dashboard.title,
      uid: dashboardDTO.dashboard.uid,
      folderTitle: dashboardDTO.meta.folderTitle ?? '',
      folderUid: dashboardDTO.meta.folderUid ?? '',
    };
  } else if (isDashboardV2Resource(dashboardDTO)) {
    unifiedDashboard = {
      panels: Object.values(dashboardDTO.spec.elements).map((element: PanelKind | LibraryPanelKind) => ({
        id: element.spec.id,
        title: element.spec.title,
        type: element.kind === 'Panel' ? element.spec.vizConfig.group : 'LibraryPanel',
      })),
      title: dashboardDTO.spec.title,
      uid: dashboardDTO.metadata.name,
      folderTitle: dashboardDTO.metadata.annotations?.[AnnoKeyFolderTitle] ?? '',
      folderUid: dashboardDTO.metadata.annotations?.[AnnoKeyFolder] ?? '',
    };
  } else {
    throw new Error('Unexpected dashboard format');
  }

  return unifiedDashboard;
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
