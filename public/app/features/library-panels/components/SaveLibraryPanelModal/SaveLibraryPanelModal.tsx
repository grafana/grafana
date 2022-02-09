import React, { useCallback, useState } from 'react';
import { Button, Icon, Input, Modal, useStyles } from '@grafana/ui';
import { useAsync, useDebounce } from 'react-use';
import { usePanelSave } from '../../utils/usePanelSave';
import { getConnectedDashboards } from '../../state/api';
import { PanelModelWithLibraryPanel } from '../../types';
import { getModalStyles } from '../../styles';

interface Props {
  panel: PanelModelWithLibraryPanel;
  folderId: number;
  isUnsavedPrompt?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  onDiscard: () => void;
}

export const SaveLibraryPanelModal: React.FC<Props> = ({
  panel,
  folderId,
  isUnsavedPrompt,
  onDismiss,
  onConfirm,
  onDiscard,
}) => {
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
  const styles = useStyles(getModalStyles);
  const discardAndClose = useCallback(() => {
    onDiscard();
  }, [onDiscard]);

  const title = isUnsavedPrompt ? 'Unsaved library panel changes' : 'Save library panel';

  return (
    <Modal title={title} icon="save" onDismiss={onDismiss} isOpen={true}>
      <div>
        <p className={styles.textInfo}>
          {'This update will affect '}
          <strong>
            {panel.libraryPanel.meta.connectedDashboards}{' '}
            {panel.libraryPanel.meta.connectedDashboards === 1 ? 'dashboard' : 'dashboards'}.
          </strong>
          The following dashboards using the panel will be affected:
        </p>
        <Input
          className={styles.dashboardSearch}
          prefix={<Icon name="search" />}
          placeholder="Search affected dashboards"
          value={searchString}
          onChange={(e) => setSearchString(e.currentTarget.value)}
        />
        {dashState.loading ? (
          <p>Loading connected dashboards...</p>
        ) : (
          <table className={styles.myTable}>
            <thead>
              <tr>
                <th>Dashboard name</th>
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
            Cancel
          </Button>
          {isUnsavedPrompt && (
            <Button variant="destructive" onClick={discardAndClose}>
              Discard
            </Button>
          )}
          <Button
            onClick={() => {
              saveLibraryPanel(panel, folderId).then(() => {
                onConfirm();
              });
            }}
          >
            Update all
          </Button>
        </Modal.ButtonRow>
      </div>
    </Modal>
  );
};
