import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { PanelPluginMeta } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { changeToLibraryPanel } from 'app/features/panel/state/actions';
import { useDispatch } from 'app/types/store';

import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { LibraryElementDTO } from '../../types';
import { AddLibraryPanelModal } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { ChangeLibraryPanelModal } from '../ChangeLibraryPanelModal/ChangeLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';

interface Props {
  panel: PanelModel;
  searchQuery: string;
}

export const PanelLibraryOptionsGroup = ({ panel, searchQuery }: Props) => {
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
    dispatch(changeToLibraryPanel(panel, changeToPanel));
  };

  const onAddToPanelLibrary = () => setShowingAddPanelModal(true);
  const onDismissChangeToPanel = () => setChangeToPanel(undefined);
  return (
    <Stack direction="column" gap={2}>
      {!panel.libraryPanel && (
        <Stack alignItems="center">
          <Button icon="plus" onClick={onAddToPanelLibrary} variant="secondary" fullWidth>
            <Trans i18nKey="library-panels.panel-library-options-group.create-new-library-panel">
              Create new library panel
            </Trans>
          </Button>
        </Stack>
      )}

      <PanelTypeFilter onChange={onPanelFilterChange} />

      <div className={styles.libraryPanelsView}>
        <LibraryPanelsView
          currentPanelId={panel.libraryPanel?.uid}
          searchString={searchQuery}
          panelFilter={panelFilter}
          onClickCard={setChangeToPanel}
          showSecondaryActions
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
    </Stack>
  );
};

const styles = {
  libraryPanelsView: css({
    width: '100%',
  }),
};
