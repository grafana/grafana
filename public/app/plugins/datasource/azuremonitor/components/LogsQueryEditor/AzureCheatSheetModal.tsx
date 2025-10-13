import { CoreApp } from '@grafana/data';
import { Modal } from '@grafana/ui';

import AzureLogAnalyticsDatasource from '../../azure_log_analytics/azure_log_analytics_datasource';
import { AzureMonitorQuery } from '../../dataquery.gen';

import AzureCheatSheet from './AzureCheatSheet';

type Props = {
  isOpen: boolean;
  app?: CoreApp;
  onClose: () => void;
  onChange: (query: AzureMonitorQuery) => void;
  onAddQuery?: (query: AzureMonitorQuery) => void;
  datasource: AzureLogAnalyticsDatasource;
};

export const AzureCheatSheetModal = (props: Props) => {
  const { isOpen, onClose, datasource, onChange } = props;

  return (
    <Modal aria-label="Kick start your query modal" isOpen={isOpen} title="Kick start your query" onDismiss={onClose}>
      <AzureCheatSheet
        onChange={(a) => {
          onChange(a);
          onClose();
        }}
        query={{ refId: 'A' }}
        datasource={datasource}
      ></AzureCheatSheet>
    </Modal>
  );
};
