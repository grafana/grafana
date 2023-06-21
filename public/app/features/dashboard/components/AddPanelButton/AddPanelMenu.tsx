import React, { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';
import {
  getCopiedPanelPlugin,
  onAddLibraryPanel,
  onCreateNewPanel,
  onCreateNewRow,
  onPasteCopiedPanel,
} from 'app/features/dashboard/utils/dashboard';
import { useDispatch, useSelector } from 'app/types';

import { setInitialDatasource } from '../../state/reducers';

export interface Props {
  dashboard: DashboardModel;
}

const AddPanelMenu = ({ dashboard }: Props) => {
  const copiedPanelPlugin = useMemo(() => getCopiedPanelPlugin(), []);
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

  return (
    <Menu>
      <Menu.Item
        key="add-visualisation"
        testId={selectors.pages.AddDashboard.itemButton('Add new visualization menu item')}
        label={t('dashboard.add-menu.visualization', 'Visualization')}
        onClick={() => {
          const id = onCreateNewPanel(dashboard, initialDatasource);
          reportInteraction('dashboards_toolbar_add_clicked', { item: 'add_visualization' });
          locationService.partial({ editPanel: id });
          dispatch(setInitialDatasource(undefined));
        }}
      />
      <Menu.Item
        key="add-row"
        testId={selectors.pages.AddDashboard.itemButton('Add new row menu item')}
        label={t('dashboard.add-menu.row', 'Row')}
        onClick={() => {
          reportInteraction('dashboards_toolbar_add_clicked', { item: 'add_row' });
          onCreateNewRow(dashboard);
        }}
      />
      <Menu.Item
        key="add-panel-lib"
        testId={selectors.pages.AddDashboard.itemButton('Add new panel from panel library menu item')}
        label={t('dashboard.add-menu.import', 'Import from library')}
        onClick={() => {
          reportInteraction('dashboards_toolbar_add_clicked', { item: 'import_from_library' });
          onAddLibraryPanel(dashboard);
        }}
      />
      <Menu.Item
        key="add-panel-clipboard"
        testId={selectors.pages.AddDashboard.itemButton('Add new panel from clipboard menu item')}
        label={t('dashboard.add-menu.paste-panel', 'Paste panel')}
        onClick={() => {
          reportInteraction('dashboards_toolbar_add_clicked', { item: 'paste_panel' });
          onPasteCopiedPanel(dashboard, copiedPanelPlugin);
        }}
        disabled={!copiedPanelPlugin}
      />
    </Menu>
  );
};

export default AddPanelMenu;
