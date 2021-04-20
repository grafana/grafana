import React, { FC, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';

import { PanelModel } from 'app/features/dashboard/state';
import { AddLibraryPanelModal } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { PanelOptionsChangedEvent, PanelQueriesChangedEvent } from 'app/types/events';
import { LibraryPanelDTO } from '../../types';
import { toPanelModelLibraryPanel } from '../../utils';
import { changePanelPlugin } from 'app/features/dashboard/state/actions';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { ChangeLibraryPanelModal } from '../ChangeLibraryPanelModal/ChangeLibraryPanelModal';

interface Props {
  panel: PanelModel;
  searchQuery: string;
}

export const PanelLibraryOptionsGroup: FC<Props> = ({ panel, searchQuery }) => {
  const styles = useStyles(getStyles);
  const [showingAddPanelModal, setShowingAddPanelModal] = useState(false);
  const [changeToPanel, setChangeToPanel] = useState<LibraryPanelDTO | undefined>(undefined);
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
    panel.events.publish(new PanelQueriesChangedEvent());
    panel.events.publish(new PanelOptionsChangedEvent());
  };

  const onAddToPanelLibrary = () => {
    setShowingAddPanelModal(true);
  };

  const onChangeLibraryPanel = (panel: LibraryPanelDTO) => {
    setChangeToPanel(panel);
  };

  const onDismissChangeToPanel = () => {
    setChangeToPanel(undefined);
  };

  return (
    <div className={styles.box}>
      {!panel.libraryPanel && (
        <div className={styles.addButtonWrapper}>
          <Button icon="plus" onClick={onAddToPanelLibrary} variant="secondary" fullWidth>
            Add current panel to library
          </Button>
        </div>
      )}

      <LibraryPanelsView
        currentPanelId={panel.libraryPanel?.uid}
        searchString={searchQuery}
        onClickCard={onChangeLibraryPanel}
        showSecondaryActions
      />

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
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    box: css``,
    addButtonWrapper: css`
      padding-bottom: ${theme.spacing.md};
      text-align: center;
    `,
    panelLibraryTitle: css`
      display: flex;
      gap: 10px;
    `,
  };
};
