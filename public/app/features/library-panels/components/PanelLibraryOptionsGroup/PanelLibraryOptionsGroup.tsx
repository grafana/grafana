import React, { useState } from 'react';
import { css } from 'emotion';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import { GrafanaTheme } from '@grafana/data';
import { Button, stylesFactory, useStyles } from '@grafana/ui';

import { OptionsGroup } from 'app/features/dashboard/components/PanelEditor/OptionsGroup';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { AddLibraryPanelModal } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { PanelQueriesChangedEvent } from 'app/types/events';
import { LibraryPanelDTO } from '../../types';
import { toPanelModelLibraryPanel } from '../../utils';
import { useDispatch } from 'react-redux';
import { changePanelPlugin } from 'app/features/dashboard/state/actions';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  onChange: () => void;
}

export const PanelLibraryOptionsGroup: React.FC<Props> = ({ panel, dashboard, onChange }) => {
  const styles = useStyles(getStyles);
  const [showingAddPanelModal, setShowingAddPanelModal] = useState(false);
  const dispatch = useDispatch();

  const useLibraryPanel = (panelInfo: LibraryPanelDTO) => {
    const panelTypeChanged = panel.type !== panelInfo.model.type;
    panel.restoreModel({
      ...omit(panelInfo.model, 'type'),
      ...pick(panel, 'gridPos', 'id'),
      libraryPanel: toPanelModelLibraryPanel(panelInfo),
    });

    if (panelTypeChanged) {
      dispatch(changePanelPlugin(panel, panelInfo.model.type));
    }

    // Though the panel model has changed, since we're switching to an existing
    // library panel, we reset the "hasChanged" state.
    panel.hasChanged = false;
    panel.refresh();
    panel.events.publish(PanelQueriesChangedEvent);

    // onChange is called here to force the panel editor to re-render
    onChange();
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
