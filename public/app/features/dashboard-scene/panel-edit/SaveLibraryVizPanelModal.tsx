import { useCallback, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { Button, Icon, Input, Modal, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { getConnectedDashboards } from 'app/features/library-panels/state/api';
import { getModalStyles } from 'app/features/library-panels/styles';

import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';

interface Props {
  libraryPanel: LibraryPanelBehavior;
  isUnsavedPrompt?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  onDiscard: () => void;
}

export const SaveLibraryVizPanelModal = ({ libraryPanel, isUnsavedPrompt, onDismiss, onConfirm, onDiscard }: Props) => {
  const [searchString, setSearchString] = useState('');
  const dashState = useAsync(async () => {
    const searchHits = await getConnectedDashboards(libraryPanel.state.uid);
    if (searchHits.length > 0) {
      return searchHits.map((dash) => dash.title);
    }

    return [];
  }, [libraryPanel.state.uid]);

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

  const styles = useStyles2(getModalStyles);
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
            {libraryPanel.state._loadedPanel?.meta?.connectedDashboards}{' '}
            {libraryPanel.state._loadedPanel?.meta?.connectedDashboards === 1 ? 'dashboard' : 'dashboards'}.
          </strong>
          The following dashboards using the panel will be affected:
        </p>
        <Input
          className={styles.dashboardSearch}
          prefix={<Icon name="search" />}
          placeholder={t(
            'dashboard-scene.save-library-viz-panel-modal.placeholder-search-affected-dashboards',
            'Search affected dashboards'
          )}
          value={searchString}
          onChange={(e) => setSearchString(e.currentTarget.value)}
        />
        {dashState.loading ? (
          <p>
            <Trans i18nKey="dashboard-scene.save-library-viz-panel-modal.loading-connected-dashboards">
              Loading connected dashboards...
            </Trans>
          </p>
        ) : (
          <table className={styles.myTable}>
            <thead>
              <tr>
                <th>
                  <Trans i18nKey="dashboard-scene.save-library-viz-panel-modal.dashboard-name">Dashboard name</Trans>
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
            <Trans i18nKey="dashboard-scene.save-library-viz-panel-modal.cancel">Cancel</Trans>
          </Button>
          {isUnsavedPrompt && (
            <Button variant="destructive" onClick={discardAndClose}>
              <Trans i18nKey="dashboard-scene.save-library-viz-panel-modal.discard">Discard</Trans>
            </Button>
          )}
          <Button
            onClick={() => {
              onConfirm();
            }}
          >
            <Trans i18nKey="dashboard-scene.save-library-viz-panel-modal.update-all">Update all</Trans>
          </Button>
        </Modal.ButtonRow>
      </div>
    </Modal>
  );
};
