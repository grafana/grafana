import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { AsyncSelect, Button, Modal, useStyles2 } from '@grafana/ui';

import { DashboardSearchItem } from '../../../search/types';
import { getConnectedDashboards, getLibraryPanelConnectedDashboards } from '../../state/api';
import { LibraryElementDTO } from '../../types';

export interface OpenLibraryPanelModalProps {
  onDismiss: () => void;
  libraryPanel: LibraryElementDTO;
}

export function OpenLibraryPanelModal({ libraryPanel, onDismiss }: OpenLibraryPanelModalProps): JSX.Element {
  const styles = useStyles2(getStyles);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(0);
  const [option, setOption] = useState<SelectableValue<DashboardSearchItem> | undefined>(undefined);
  useEffect(() => {
    const getConnected = async () => {
      const connectedDashboards = await getLibraryPanelConnectedDashboards(libraryPanel.uid);
      setConnected(connectedDashboards.length);
    };
    getConnected();
  }, [libraryPanel.uid]);
  const loadOptions = useCallback(
    (searchString: string) => loadOptionsAsync(libraryPanel.uid, searchString, setLoading),
    [libraryPanel.uid]
  );
  const debouncedLoadOptions = useMemo(() => debounce(loadOptions, 300, { leading: true }), [loadOptions]);
  const onViewPanel = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    locationService.push(urlUtil.renderUrl(`/d/${option?.value?.uid}`, {}));
  };

  return (
    <Modal title="View panel in dashboard" onDismiss={onDismiss} onClickBackdrop={onDismiss} isOpen>
      <div className={styles.container}>
        {connected === 0 ? (
          <span>Panel is not linked to a dashboard. Add the panel to a dashboard and retry.</span>
        ) : null}
        {connected > 0 ? (
          <>
            <p>
              This panel is being used in{' '}
              <strong>
                {connected} {connected > 1 ? 'dashboards' : 'dashboard'}
              </strong>
              .Please choose which dashboard to view the panel in:
            </p>
            <AsyncSelect
              isClearable
              isLoading={loading}
              defaultOptions={true}
              loadOptions={debouncedLoadOptions}
              onChange={setOption}
              placeholder="Start typing to search for dashboard"
              noOptionsMessage="No dashboards found"
            />
          </>
        ) : null}
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>
        <Button onClick={onViewPanel} disabled={!Boolean(option)}>
          {option ? `View panel in ${option?.label}...` : 'View panel in dashboard...'}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

async function loadOptionsAsync(uid: string, searchString: string, setLoading: (loading: boolean) => void) {
  setLoading(true);
  const searchHits = await getConnectedDashboards(uid);
  const options = searchHits
    .filter((d) => d.title.toLowerCase().includes(searchString.toLowerCase()))
    .map((d) => ({ label: d.title, value: d }));
  setLoading(false);

  return options;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css``,
  };
}
