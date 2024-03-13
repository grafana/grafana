import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { PanelPluginMeta } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { Button, VerticalGroup } from '@grafana/ui';
import { PanelTypeFilter } from 'app/core/components/PanelTypeFilter/PanelTypeFilter';
import { LibraryPanelsView } from 'app/features/library-panels/components/LibraryPanelsView/LibraryPanelsView';
import { LibraryElementDTO } from 'app/features/library-panels/types';

import { LibraryVizPanel } from '../../scene/LibraryVizPanel';
import { getDashboardSceneFor } from '../../utils/utils';

import { AddLibraryPanelModal } from './AddLibraryPanelModal';
import { ChangeLibraryPanelModal } from './ChangeLibraryPanelModal';

interface Props {
  panel: VizPanel;
  searchQuery: string;
  isWidget?: boolean;
}

export const PanelLibraryOptionsGroup = ({ panel, searchQuery, isWidget = false }: Props) => {
  const [showingAddPanelModal, setShowingAddPanelModal] = useState(false);
  // todo think this needs modifications
  const [changeToPanel, setChangeToPanel] = useState<LibraryElementDTO | undefined>(undefined);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);

  const onPanelFilterChange = useCallback(
    (plugins: PanelPluginMeta[]) => {
      setPanelFilter(plugins.map((p) => p.id));
    },
    [setPanelFilter]
  );

  const dashboard = getDashboardSceneFor(panel);

  const useLibraryPanel = async () => {
    //TODO change library panel
    // old code
    // if (!changeToPanel) {
    //   return;
    // }
    // setChangeToPanel(undefined);
    // dispatch(changeToLibraryPanel(panel, changeToPanel));
  };

  const isLibraryPanel = panel.parent instanceof LibraryVizPanel;

  const onAddToPanelLibrary = () => setShowingAddPanelModal(true);
  const onDismissChangeToPanel = () => setChangeToPanel(undefined);
  return (
    <VerticalGroup spacing="md">
      {!isLibraryPanel && (
        <VerticalGroup align="center">
          <Button icon="plus" onClick={onAddToPanelLibrary} variant="secondary" fullWidth>
            Create new library panel
          </Button>
        </VerticalGroup>
      )}

      <PanelTypeFilter onChange={onPanelFilterChange} isWidget={isWidget} />

      <div className={styles.libraryPanelsView}>
        <LibraryPanelsView
          currentPanelId={isLibraryPanel ? panel.parent.state.uid : undefined}
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
          initialFolderUid={dashboard.state.meta.folderUid}
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
  libraryPanelsView: css`
    width: 100%;
  `,
};
