import { useMemo } from 'react';

import { locationService } from '@grafana/runtime';
import { buildPanelEditScene } from 'app/features/dashboard-scene/panel-edit/PanelEditor';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useDispatch, useSelector } from 'app/types/store';

import { setInitialDatasource } from '../../state/reducers';
import {
  onCreateNewPanel,
  onAddLibraryPanel as onAddLibraryPanelImpl,
  onImportDashboard as onImportDashboardImpl,
} from '../../utils/dashboard';

import type { Props } from './DashboardEmpty';

export const useIsReadOnlyRepo = ({ dashboard }: Props) => {
  const { isReadOnlyRepo } = useGetResourceRepositoryView({
    folderName: dashboard instanceof DashboardScene ? dashboard.state.meta.folderUid : dashboard.meta.folderUid,
  });

  return isReadOnlyRepo;
};

interface HookProps extends Props {
  isReadOnlyRepo: boolean;
}

export const useOnAddVisualization = ({ dashboard, canCreate, isReadOnlyRepo }: HookProps) => {
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

  return useMemo(() => {
    if (!canCreate || isReadOnlyRepo) {
      return undefined;
    }

    return () => {
      if (dashboard instanceof DashboardScene) {
        const panel = dashboard.onCreateNewPanel();
        dashboard.setState({ editPanel: buildPanelEditScene(panel, true) });
        locationService.partial({ firstPanel: true });
      } else {
        const id = onCreateNewPanel(dashboard, initialDatasource);
        dispatch(setInitialDatasource(undefined));
        locationService.partial({ editPanel: id, firstPanel: true });
      }

      DashboardInteractions.emptyDashboardButtonClicked({ item: 'add_visualization' });
    };
  }, [canCreate, isReadOnlyRepo, dashboard, dispatch, initialDatasource]);
};

export const useOnAddLibraryPanel = ({ dashboard, canCreate, isReadOnlyRepo }: HookProps) => {
  const isProvisioned = dashboard instanceof DashboardScene && dashboard.isManagedRepository();

  return useMemo(() => {
    if (!canCreate || isProvisioned || isReadOnlyRepo) {
      return undefined;
    }

    return () => {
      DashboardInteractions.emptyDashboardButtonClicked({ item: 'import_from_library' });
      if (dashboard instanceof DashboardScene) {
        dashboard.onShowAddLibraryPanelDrawer();
      } else {
        onAddLibraryPanelImpl(dashboard);
      }
    };
  }, [canCreate, isProvisioned, isReadOnlyRepo, dashboard]);
};

export const useOnImportDashboard = ({ dashboard, canCreate, isReadOnlyRepo }: HookProps) => {
  return useMemo(() => {
    if (!canCreate || isReadOnlyRepo) {
      return undefined;
    }

    return () => {
      DashboardInteractions.emptyDashboardButtonClicked({ item: 'import_dashboard' });
      onImportDashboardImpl();
    };
  }, [canCreate, isReadOnlyRepo]);
};
