import React, { useMemo } from 'react';

import { locationService, reportInteraction } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state';
import {
  getCopiedPanelPlugin,
  onAddLibraryPanel,
  onCreateNewPanel,
  onCreateNewRow,
  onPasteCopiedPanel,
} from 'app/features/dashboard/utils/dashboard';

interface Props {
  dashboard: DashboardModel;
}

export const AddPanelMenu = ({ dashboard }: Props) => {
  const copiedPanelPlugin = useMemo(() => getCopiedPanelPlugin(), []);

  return (
    <Menu>
      <Menu.Item
        key="add-visualisation"
        label="Visualization"
        ariaLabel="Add new panel"
        onClick={() => {
          reportInteraction('Create new panel');
          const id = onCreateNewPanel(dashboard);
          locationService.partial({ editPanel: id });
        }}
      />
      <Menu.Item
        key="add-row"
        label="Row"
        ariaLabel="Add new row"
        onClick={() => {
          reportInteraction('Create new row');
          onCreateNewRow(dashboard);
        }}
      />
      <Menu.Item
        key="add-panel-lib"
        label="Import from library"
        ariaLabel="Add new panel from panel library"
        onClick={() => {
          reportInteraction('Add a panel from the panel library');
          onAddLibraryPanel(dashboard);
        }}
      />
      <Menu.Item
        key="add-panel-clipboard"
        label="Paste panel"
        ariaLabel="Add new panel from clipboard"
        onClick={() => {
          reportInteraction('Paste panel from clipboard');
          onPasteCopiedPanel(dashboard, copiedPanelPlugin);
        }}
        disabled={!copiedPanelPlugin}
      />
    </Menu>
  );
};
