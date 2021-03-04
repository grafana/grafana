import React, { useState } from 'react';
import { css } from 'emotion';
import pick from 'lodash/pick';
import { GrafanaTheme } from '@grafana/data';
import { Button, stylesFactory, useStyles } from '@grafana/ui';

import { OptionsGroup } from 'app/features/dashboard/components/PanelEditor/OptionsGroup';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { AddLibraryPanelModal } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { PanelQueriesChangedEvent } from 'app/types/events';
import { LibraryPanelDTO } from '../../types';
import { toPanelModelLibraryPanel } from '../../utils';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export const PanelLibraryOptionsGroup: React.FC<Props> = ({ panel, dashboard }) => {
  const styles = useStyles(getStyles);
  const [showingAddPanelModal, setShowingAddPanelModal] = useState(false);

  const useLibraryPanel = (panelInfo: LibraryPanelDTO) => {
    panel.restoreModel({
      ...panelInfo.model,
      ...pick(panel, 'gridPos', 'id'),
      libraryPanel: toPanelModelLibraryPanel(panelInfo),
    });

    // Though the panel model has changed, since we're switching to an existing
    // library panel, we reset the "hasChanged" state.
    panel.hasChanged = false;

    panel.refresh();
    panel.events.publish(PanelQueriesChangedEvent);
  };

  const onAddToPanelLibrary = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setShowingAddPanelModal(true);
  };

  return (
    <OptionsGroup
      renderTitle={(isExpanded) => {
        return isExpanded && !panel.libraryPanel ? (
          <div className={styles.panelLibraryTitle}>
            <span>Panel library</span>
            <Button size="sm" onClick={onAddToPanelLibrary}>
              Add this panel to the panel library
            </Button>
          </div>
        ) : (
          'Panel library'
        );
      }}
      id="panel-library"
      key="panel-library"
      defaultToClosed
    >
      <LibraryPanelsView
        formatDate={(dateString: string) => dashboard.formatDate(dateString, 'L')}
        currentPanelId={panel.libraryPanel?.uid}
        showSecondaryActions
      >
        {(panel) => (
          <Button variant="secondary" onClick={() => useLibraryPanel(panel)}>
            Use instead of current panel
          </Button>
        )}
      </LibraryPanelsView>
      {showingAddPanelModal && (
        <AddLibraryPanelModal
          panel={panel}
          onDismiss={() => setShowingAddPanelModal(false)}
          initialFolderId={dashboard.meta.folderId}
          isOpen={showingAddPanelModal}
        />
      )}
    </OptionsGroup>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    panelLibraryTitle: css`
      display: flex;
      gap: 10px;
    `,
  };
});
