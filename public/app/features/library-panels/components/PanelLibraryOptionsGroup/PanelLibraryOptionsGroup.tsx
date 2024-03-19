import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { PanelModel, PanelPluginMeta } from '@grafana/data';
import { LibraryPanel } from '@grafana/schema/dist/esm/index.gen';
import { Button, Stack, VerticalGroup } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PanelModel as LegacyPanelModel } from 'app/features/dashboard/state';
import { VizPanelManager } from 'app/features/dashboard-scene/panel-edit/VizPanelManager';
import { changeToLibraryPanel } from 'app/features/panel/state/actions';
import { useDispatch } from 'app/types';

import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { AddLibraryPanelModal, AddLibraryPanelModal2 } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { ChangeLibraryPanelModal, ChangeLibraryPanelModal2 } from '../ChangeLibraryPanelModal/ChangeLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';

interface Props {
  panel: LegacyPanelModel;
  searchQuery: string;
  isWidget?: boolean;
}

export const PanelLibraryOptionsGroup = ({ panel, searchQuery, isWidget = false }: Props) => {
  const [showingAddPanelModal, setShowingAddPanelModal] = useState(false);
  const [changeToPanel, setChangeToPanel] = useState<LibraryPanel | undefined>(undefined);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);

  const onPanelFilterChange = useCallback(
    (plugins: PanelPluginMeta[]) => {
      setPanelFilter(plugins.map((p) => p.id));
    },
    [setPanelFilter]
  );
  const dashboard = getDashboardSrv().getCurrent();
  const dispatch = useDispatch();

  const useLibraryPanel = async () => {
    if (!changeToPanel) {
      return;
    }

    setChangeToPanel(undefined);

    dispatch(changeToLibraryPanel(panel, changeToPanel));
  };

  const onAddToPanelLibrary = () => setShowingAddPanelModal(true);
  const onDismissChangeToPanel = () => setChangeToPanel(undefined);
  return (
    <VerticalGroup spacing="md">
      {!panel.libraryPanel && (
        <VerticalGroup align="center">
          <Button icon="plus" onClick={onAddToPanelLibrary} variant="secondary" fullWidth>
            Create new library panel
          </Button>
        </VerticalGroup>
      )}

      <PanelTypeFilter onChange={onPanelFilterChange} isWidget={isWidget} />

      <div className={styles.libraryPanelsView}>
        <LibraryPanelsView
          currentPanelId={panel.libraryPanel?.uid}
          searchString={searchQuery}
          panelFilter={panelFilter}
          onClickCard={setChangeToPanel}
          showSecondaryActions
          isWidget={isWidget}
        />
      </div>

      {showingAddPanelModal && (
        <AddLibraryPanelModal
          panel={panel}
          onDismiss={() => setShowingAddPanelModal(false)}
          initialFolderUid={dashboard?.meta.folderUid}
          isOpen={showingAddPanelModal}
        />
      )}

      {changeToPanel && (
        <ChangeLibraryPanelModal panel={panel} onDismiss={onDismissChangeToPanel} onConfirm={useLibraryPanel} />
      )}
    </VerticalGroup>
  );
};

// --------- dashboard scene ----------

interface Props2 {
  panel: PanelModel;
  searchQuery: string;
  vizPanelManager: VizPanelManager;
  isWidget?: boolean;
}

export const PanelLibraryOptionsGroup2 = ({ panel, searchQuery, vizPanelManager, isWidget = false }: Props2) => {
  const [showingAddPanelModal, setShowingAddPanelModal] = useState(false);
  const [changeToPanel, setChangeToPanel] = useState<LibraryPanel | undefined>(undefined);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);
  const vizPanel = vizPanelManager?.state.panel;

  const onPanelFilterChange = useCallback(
    (plugins: PanelPluginMeta[]) => {
      setPanelFilter(plugins.map((p) => p.id));
    },
    [setPanelFilter]
  );
  const dashboard = getDashboardSrv().getCurrent();

  const useLibraryPanel = async () => {
    if (!changeToPanel) {
      return;
    }

    setChangeToPanel(undefined);

    vizPanelManager.changeToLibraryPanel(changeToPanel);
  };

  const onAddToPanelLibrary = () => setShowingAddPanelModal(true);
  const onDismissChangeToPanel = () => setChangeToPanel(undefined);
  return (
    <Stack direction="column" gap={2}>
      {!panel.libraryPanel && (
        <Stack alignItems="center">
          <Button icon="plus" onClick={onAddToPanelLibrary} variant="secondary" fullWidth>
            Create new library panel
          </Button>
        </Stack>
      )}

      <PanelTypeFilter onChange={onPanelFilterChange} isWidget={isWidget} />

      <div className={styles.libraryPanelsView}>
        <LibraryPanelsView
          currentPanelId={panel.libraryPanel?.uid}
          searchString={searchQuery}
          panelFilter={panelFilter}
          onClickCard={setChangeToPanel}
          showSecondaryActions
          isWidget={isWidget}
        />
      </div>

      {showingAddPanelModal && (
        <AddLibraryPanelModal2
          panel={panel}
          onDismiss={() => setShowingAddPanelModal(false)}
          initialFolderUid={dashboard?.meta.folderUid}
          isOpen={showingAddPanelModal}
          vizPanel={vizPanel}
        />
      )}

      {changeToPanel && (
        <ChangeLibraryPanelModal2 panel={panel} onDismiss={onDismissChangeToPanel} onConfirm={useLibraryPanel} />
      )}
    </Stack>
  );
};

const styles = {
  libraryPanelsView: css({
    width: '100%',
  }),
};
