import React from 'react';

import { CoreApp } from '@grafana/data';
import { Modal } from '@grafana/ui';

import AzureResourceGraphDatasource from '../../azure_resource_graph/azure_resource_graph_datasource';
import { AzureMonitorQuery } from '../../dataquery.gen';

import ArgCheatSheet from './ArgCheatSheet';

type Props = {
  isOpen: boolean;
  app?: CoreApp;
  onClose: () => void;
  onChange: (query: AzureMonitorQuery) => void;
  onAddQuery?: (query: AzureMonitorQuery) => void;
  datasource: AzureResourceGraphDatasource;
};

export const ArgCheatSheetModal = (props: Props) => {
  const { isOpen, onClose, datasource, onChange } = props;

  return (
    <Modal aria-label="Kick start your query modal" isOpen={isOpen} title="Kick start your query" onDismiss={onClose}>
      <ArgCheatSheet
        onChange={(a) => {
          onChange(a);
          onClose();
        }}
        query={{ refId: 'A' }}
        datasource={datasource}
      />
    </Modal>
  );
};
