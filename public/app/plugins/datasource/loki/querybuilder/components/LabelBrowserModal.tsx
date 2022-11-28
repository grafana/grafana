import React from 'react';

import { CoreApp } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Modal } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

import LanguageProvider from '../../LanguageProvider';
import { LokiLabelBrowser } from '../../components/LokiLabelBrowser';
import { LokiQuery } from '../../types';

export interface Props {
  isOpen: boolean;
  languageProvider: LanguageProvider;
  query: LokiQuery;
  app?: CoreApp;
  onClose: () => void;
  onChange: (query: LokiQuery) => void;
  onRunQuery: () => void;
}

export const LabelBrowserModal = (props: Props) => {
  const { isOpen, onClose, languageProvider, app } = props;

  const LAST_USED_LABELS_KEY = 'grafana.datasources.loki.browser.labels';

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

  const reportInteractionAndClose = (method: string) => {
    reportInteraction('grafana_loki_label_browser_closed', {
      app: app,
      method: method,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} title="Label browser" onDismiss={reportInteractionAndClose}>
      <LocalStorageValueProvider<string[]> storageKey={LAST_USED_LABELS_KEY} defaultValue={[]}>
        {(lastUsedLabels, onLastUsedLabelsSave, onLastUsedLabelsDelete) => {
          return (
            <LokiLabelBrowser
              languageProvider={languageProvider}
              onChange={onChange}
              lastUsedLabels={lastUsedLabels}
              storeLastUsedLabels={onLastUsedLabelsSave}
              deleteLastUsedLabels={onLastUsedLabelsDelete}
              app={app}
            />
          );
        }}
      </LocalStorageValueProvider>
    </Modal>
  );
};
