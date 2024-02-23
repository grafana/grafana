import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { InlineSwitch } from '@grafana/ui';

import { PanelEditor } from './PanelEditor';

export interface Props {
  panelEditor: PanelEditor;
}

export function PanelEditControls({ panelEditor }: Props) {
  const vizManager = panelEditor.state.vizManager;
  const { panel, tableView } = vizManager.useState();
  const skipDataQuery = config.panels[panel.state.pluginId].skipDataQuery;

  return (
    <>
      {!skipDataQuery && (
        <InlineSwitch
          label="Table view"
          showLabel={true}
          id="table-view"
          value={tableView ? true : false}
          onClick={() => vizManager.toggleTableView()}
          aria-label="toggle-table-view"
          data-testid={selectors.components.PanelEditor.toggleTableView}
        />
      )}
    </>
  );
}
