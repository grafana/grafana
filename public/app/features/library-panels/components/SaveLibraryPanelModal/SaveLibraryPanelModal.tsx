import { useCallback, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { Button, Icon, Input, Modal, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getConnectedDashboards } from '../../state/api';
import { getModalStyles } from '../../styles';
import { PanelModelWithLibraryPanel } from '../../types';
import { usePanelSave } from '../../utils/usePanelSave';

interface Props {
  panel: PanelModelWithLibraryPanel;
  folderUid: string;
  isUnsavedPrompt?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  onDiscard: () => void;
}

export const SaveLibraryPanelModal = ({
  panel,
  folderUid,
  isUnsavedPrompt,
  onDismiss,
  onConfirm,
  onDiscard,
}: Props) => {
  const [searchString, setSearchString] = useState('');
  const dashState = useAsync(async () => {
    const searchHits = await getConnectedDashboards(panel.libraryPanel.uid);
    if (searchHits.length > 0) {
      return searchHits.map((dash) => dash.title);
    }

    return [];
  }, [panel.libraryPanel.uid]);

  const [filteredDashboards, setFilteredDashboards] = useState<string[]>([]);
  useDebounce(
    () => {
      if (!dashState.value) {
        return setFilteredDashboards([]);
      }

      return setFilteredDashboards(
        dashState.value.filter((dashName) => dashName.toLowerCase().includes(searchString.toLowerCase()))
      );
    },
    300,
    [dashState.value, searchString]
  );

  const { saveLibraryPanel } = usePanelSave();
  const styles = useStyles2(getModalStyles);
  const discardAndClose = useCallback(() => {
    onDiscard();
  }, [onDiscard]);

  const title = isUnsavedPrompt ? 'Unsaved library panel changes' : 'Save library panel';

  return (
    <Modal title={title} icon="save" onDismiss={onDismiss} isOpen={true}>
      <div>
        <p className={styles.textInfo}>
          <Trans
            i18nKey="library-panels.save-library-panel-modal.num-affected"
            count={panel.libraryPanel.meta?.connectedDashboards}
          >
            This update will affect <strong>{'{{count}}'} dashboards.</strong>
          </Trans>
          <Trans i18nKey="library-panels.save-library-panel-modal.affected-dashboards">
            The following dashboards using the panel will be affected:
          </Trans>
        </p>
        <Input
          className={styles.dashboardSearch}
          prefix={<Icon name="search" />}
          placeholder={t(
            'library-panels.save-library-panel-modal.placeholder-search-affected-dashboards',
            'Search affected dashboards'
          )}
          value={searchString}
          onChange={(e) => setSearchString(e.currentTarget.value)}
        />
        {dashState.loading ? (
          <p>
            <Trans i18nKey="library-panels.save-library-panel-modal.loading-connected-dashboards">
              Loading connected dashboards...
            </Trans>
          </p>
        ) : (
          <table className={styles.myTable}>
            <thead>
              <tr>
                <th>
                  <Trans i18nKey="library-panels.save-library-panel-modal.dashboard-name">Dashboard name</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDashboards.map((dashName, i) => (
                <tr key={`dashrow-${i}`}>
                  <td>{dashName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="library-panels.save-library-panel-modal.cancel">Cancel</Trans>
          </Button>
          {isUnsavedPrompt && (
            <Button variant="destructive" onClick={discardAndClose}>
              <Trans i18nKey="library-panels.save-library-panel-modal.discard">Discard</Trans>
            </Button>
          )}
          <Button
            onClick={() => {
              saveLibraryPanel(panel, folderUid).then(() => {
                onConfirm();
              });
            }}
          >
            <Trans i18nKey="library-panels.save-library-panel-modal.update-all">Update all</Trans>
          </Button>
        </Modal.ButtonRow>
      </div>
    </Modal>
  );
};
