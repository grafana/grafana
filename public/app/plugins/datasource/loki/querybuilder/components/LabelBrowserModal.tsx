import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { LoadingPlaceholder, Modal, useStyles2 } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

import { LokiLabelBrowser } from '../../components/LokiLabelBrowser';
import { LokiDatasource } from '../../datasource';
import { LokiQuery } from '../../types';

export interface Props {
  isOpen: boolean;
  datasource: LokiDatasource;
  query: LokiQuery;
  app?: CoreApp;
  onClose: () => void;
  onChange: (query: LokiQuery) => void;
  onRunQuery: () => void;
}

export const LabelBrowserModal = (props: Props) => {
  const { isOpen, onClose, datasource, app } = props;
  const [labelsLoaded, setLabelsLoaded] = useState(false);
  const [hasLogLabels, setHasLogLabels] = useState(false);
  const LAST_USED_LABELS_KEY = 'grafana.datasources.loki.browser.labels';

  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    datasource.languageProvider.fetchLabels().then((labels) => {
      setLabelsLoaded(true);
      setHasLogLabels(labels.length > 0);
    });
  }, [datasource, isOpen]);

  const changeQuery = (value: string) => {
    const { query, onChange, onRunQuery } = props;
    const nextQuery = { ...query, expr: value };
    onChange(nextQuery);
    onRunQuery();
  };

  const onChange = (selector: string) => {
    changeQuery(selector);
    onClose();
  };

  const reportInteractionAndClose = () => {
    reportInteraction('grafana_loki_label_browser_closed', {
      app,
      closeType: 'modalClose',
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} title="Label browser" onDismiss={reportInteractionAndClose} className={styles.modal}>
      {!labelsLoaded && <LoadingPlaceholder text="Loading labels..." />}
      {labelsLoaded && !hasLogLabels && <p>No labels found.</p>}
      {labelsLoaded && hasLogLabels && (
        <LocalStorageValueProvider<string[]> storageKey={LAST_USED_LABELS_KEY} defaultValue={[]}>
          {(lastUsedLabels, onLastUsedLabelsSave, onLastUsedLabelsDelete) => {
            return (
              <LokiLabelBrowser
                languageProvider={datasource.languageProvider}
                onChange={onChange}
                lastUsedLabels={lastUsedLabels}
                storeLastUsedLabels={onLastUsedLabelsSave}
                deleteLastUsedLabels={onLastUsedLabelsDelete}
                app={app}
              />
            );
          }}
        </LocalStorageValueProvider>
      )}
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css`
      width: 85vw;
      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
    `,
  };
};
