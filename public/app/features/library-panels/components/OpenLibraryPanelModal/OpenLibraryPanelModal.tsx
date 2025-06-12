import debounce from 'debounce-promise';
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { SelectableValue, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { AsyncSelect, Button, Modal } from '@grafana/ui';

import { DashboardSearchItem } from '../../../search/types';
import { getConnectedDashboards, getLibraryPanelConnectedDashboards } from '../../state/api';
import { LibraryElementDTO } from '../../types';

export interface OpenLibraryPanelModalProps {
  onDismiss: () => void;
  libraryPanel: LibraryElementDTO;
}

export function OpenLibraryPanelModal({ libraryPanel, onDismiss }: OpenLibraryPanelModalProps): JSX.Element {
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
    <Modal
      title={t('library-panels.modal.title', 'View panel in dashboard')}
      onDismiss={onDismiss}
      onClickBackdrop={onDismiss}
      isOpen
    >
      <div>
        {connected === 0 ? (
          <span>
            <Trans i18nKey={'library-panels.modal.panel-not-linked'}>
              Panel is not linked to a dashboard. Add the panel to a dashboard and retry.
            </Trans>
          </span>
        ) : null}
        {connected > 0 ? (
          <>
            <p>
              <Trans i18nKey="library-panels.modal.body" count={connected}>
                This panel is being used in {{ count: connected }} dashboard. Please choose which dashboard to view the
                panel in:
              </Trans>
            </p>
            <AsyncSelect
              isClearable
              isLoading={loading}
              defaultOptions={true}
              loadOptions={debouncedLoadOptions}
              onChange={setOption}
              placeholder={t('library-panels.modal.select-placeholder', 'Start typing to search for dashboard')}
              noOptionsMessage={t('library-panels.modal.select-no-options-message', 'No dashboards found')}
            />
          </>
        ) : null}
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey={'library-panels.modal.button-cancel'}>Cancel</Trans>
        </Button>
        <Button onClick={onViewPanel} disabled={!Boolean(option)}>
          {option
            ? t('library-panels.modal.button-view-panel1', 'View panel in {{label}}...', { label: option?.label })
            : t('library-panels.modal.button-view-panel2', 'View panel in dashboard...')}
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
