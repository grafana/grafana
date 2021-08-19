import React, { FC, useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelPluginMeta } from '@grafana/data';
import { Button, useStyles2, VerticalGroup } from '@grafana/ui';

import { PanelModel } from 'app/features/dashboard/state';
import { AddLibraryPanelModal } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { PanelDirectiveReadyEvent, PanelOptionsChangedEvent, PanelQueriesChangedEvent } from 'app/types/events';
import { LibraryElementDTO } from '../../types';
import { toPanelModelLibraryPanel } from '../../utils';
import { changePanelPlugin } from 'app/features/dashboard/state/actions';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { ChangeLibraryPanelModal } from '../ChangeLibraryPanelModal/ChangeLibraryPanelModal';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';

interface Props {
  panel: PanelModel;
  searchQuery: string;
}

export const PanelLibraryOptionsGroup: FC<Props> = ({ panel, searchQuery }) => {
  const styles = useStyles2(getStyles);
  const [showingAddPanelModal, setShowingAddPanelModal] = useState(false);
  const [changeToPanel, setChangeToPanel] = useState<LibraryElementDTO | undefined>(undefined);
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

    const panelTypeChanged = panel.type !== changeToPanel.model.type;

    if (panelTypeChanged) {
      await dispatch(changePanelPlugin(panel, changeToPanel.model.type));
    }

    panel.restoreModel({
      ...changeToPanel.model,
      gridPos: panel.gridPos,
      id: panel.id,
      libraryPanel: toPanelModelLibraryPanel(changeToPanel),
    });

    panel.configRev = 0;
    panel.refresh();
    const unsubscribeEvent = panel.events.subscribe(PanelDirectiveReadyEvent, () => {
      panel.refresh();
      unsubscribeEvent.unsubscribe();
    });
    panel.events.publish(PanelQueriesChangedEvent);
    panel.events.publish(PanelOptionsChangedEvent);
  };

  const onAddToPanelLibrary = () => {
    setShowingAddPanelModal(true);
  };

  const onChangeLibraryPanel = (panel: LibraryElementDTO) => {
    setChangeToPanel(panel);
  };

  const onDismissChangeToPanel = () => {
    setChangeToPanel(undefined);
  };

  return (
    <VerticalGroup spacing="md">
      {!panel.libraryPanel && (
        <VerticalGroup align="center">
          <Button icon="plus" onClick={onAddToPanelLibrary} variant="secondary" fullWidth>
            Create new library panel
          </Button>
        </VerticalGroup>
      )}

      <PanelTypeFilter onChange={onPanelFilterChange} />

      <div className={styles.libraryPanelsView}>
        <LibraryPanelsView
          currentPanelId={panel.libraryPanel?.uid}
          searchString={searchQuery}
          panelFilter={panelFilter}
          onClickCard={onChangeLibraryPanel}
          showSecondaryActions
        />
      </div>

      {showingAddPanelModal && (
        <AddLibraryPanelModal
          panel={panel}
          onDismiss={() => setShowingAddPanelModal(false)}
          initialFolderId={dashboard?.meta.folderId}
          isOpen={showingAddPanelModal}
        />
      )}

      {changeToPanel && (
        <ChangeLibraryPanelModal panel={panel} onDismiss={onDismissChangeToPanel} onConfirm={useLibraryPanel} />
      )}
    </VerticalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    libraryPanelsView: css`
      width: 100%;
    `,
  };
};
