import { useCallback } from 'react';

import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import {
  useRepositoryStatus,
  useOnAddVisualization,
  useOnAddLibraryPanel,
  useOnImportDashboard,
} from './DashboardEmptyHooks';
import { DashboardEmptyInternal } from './DashboardEmptyInternal';

export interface Props {
  dashboard: DashboardModel | DashboardScene;
  canCreate: boolean;
}

// We pass the default empty UI through to the extension point so that the extension can conditionally render it if needed.
// For example, an extension might want to render custom UI for a specific experiment cohort, and the default UI for everyone else.
const DashboardEmpty = (props: Props) => {
  const { isReadOnlyRepo, isProvisioned } = useRepositoryStatus(props);
  const onAddVisualization = useOnAddVisualization({ ...props, isReadOnlyRepo, isProvisioned });
  const onAddLibraryPanel = useOnAddLibraryPanel({ ...props, isReadOnlyRepo, isProvisioned });
  const onImportDashboard = useOnImportDashboard({ ...props, isReadOnlyRepo, isProvisioned });
  const renderDefaultUI = useCallback(
    () => (
      <DashboardEmptyInternal
        dashboard={props.dashboard}
        onAddVisualization={onAddVisualization}
        onAddLibraryPanel={onAddLibraryPanel}
        onImportDashboard={onImportDashboard}
      />
    ),
    [onAddVisualization, onAddLibraryPanel, onImportDashboard, props.dashboard]
  );

  // Commented out for testing purposes
  // return (
  //   <DashboardEmptyExtensionPoint
  //     renderDefaultUI={renderDefaultUI}
  //     onAddVisualization={onAddVisualization}
  //     onAddLibraryPanel={onAddLibraryPanel}
  //     onImportDashboard={onImportDashboard}
  //   />
  // );

  return renderDefaultUI();
};

export default DashboardEmpty;
