import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { PanelPluginMeta } from '@grafana/data';
import { SceneGridItem, VizPanel } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema/dist/esm/index.gen';
import { Button, VerticalGroup } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PanelModel } from 'app/features/dashboard/state';
import { LibraryVizPanel } from 'app/features/dashboard-scene/scene/LibraryVizPanel';
import { buildGridItemForLibPanel } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { changeToLibraryPanel } from 'app/features/panel/state/actions';
import { useDispatch } from 'app/types';

import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { AddLibraryPanelModal } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { ChangeLibraryPanelModal } from '../ChangeLibraryPanelModal/ChangeLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';

interface Props {
  panel: PanelModel;
  searchQuery: string;
  isWidget?: boolean;
  vizPanel?: VizPanel;
}

export const PanelLibraryOptionsGroup = ({ panel, searchQuery, vizPanel, isWidget = false }: Props) => {
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

    if (vizPanel) {
      const newPanelModel = new PanelModel({
        ...changeToPanel.model,
        gridPos: panel.gridPos,
        id: panel.id,
        libraryPanel: changeToPanel,
      });

      const gridItem = buildGridItemForLibPanel(newPanelModel);

      // panel repeater grid item??
      if (vizPanel.parent instanceof LibraryVizPanel && vizPanel.parent.parent instanceof SceneGridItem) {
        vizPanel.parent.parent.setState({ body: gridItem?.state.body });
        vizPanel.parent.parent.activate();
      }
    } else {
      dispatch(changeToLibraryPanel(panel, changeToPanel));
    }
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

const styles = {
  libraryPanelsView: css({
    width: '100%',
  }),
};
