import { selectors } from '@grafana/e2e-selectors';
import { Button, Dropdown, Menu } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { DashboardInteractions } from '../../../utils/interactions';
import { ToolbarActionProps } from '../types';

export function DashboardAddButton({ dashboard }: ToolbarActionProps) {
  return (
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item
            icon="graph-bar"
            label={t('dashboard.toolbar.add-new.menu.panel', 'Panel')}
            testId={selectors.components.PageToolbar.itemButton('add_visualization')}
            onClick={() => dashboard.onCreateNewPanel()}
          />
          <Menu.Item
            icon="import"
            label={t('dashboard.toolbar.add-new.menu.lib-panel', 'Library panel')}
            testId={selectors.pages.AddDashboard.itemButton('Add new panel from panel library menu item')}
            onClick={() => {
              dashboard.onShowAddLibraryPanelDrawer();
              DashboardInteractions.toolbarAddButtonClicked({ item: 'add_library_panel' });
            }}
          />
          <Menu.Item
            icon="list-ul"
            label={t('dashboard.toolbar.add-new.menu.row', 'Row')}
            testId={selectors.components.PageToolbar.itemButton('add_row')}
            onClick={() => dashboard.onCreateNewRow()}
          />
          <Menu.Item
            icon="layer-group"
            label={t('dashboard.toolbar.add-new.menu.tab', 'Tab')}
            testId={selectors.components.PageToolbar.itemButton('add_tab')}
            onClick={() => dashboard.onCreateNewTab()}
          />
        </Menu>
      }
    >
      <Button
        tooltip={t('dashboard.toolbar.add-new.button.tooltip', 'Add panels and other elements')}
        icon="plus"
        variant="primary"
        size="sm"
        fill="outline"
        data-testid={selectors.components.PageToolbar.itemButton('Add button')}
      >
        <Trans i18nKey="dashboard.toolbar.add-new.button.label">Add</Trans>
      </Button>
    </Dropdown>
  );
}
