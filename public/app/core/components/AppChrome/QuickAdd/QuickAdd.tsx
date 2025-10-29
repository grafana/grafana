import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { getDataSourceSrv, reportInteraction, config } from '@grafana/runtime';
import { Menu, Dropdown, ToolbarButton } from '@grafana/ui';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { useSelector } from 'app/types/store';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { findCreateActions } from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const navBarTree = useSelector((state) => state.navBarTree);
  const [isOpen, setIsOpen] = useState(false);

  const createActions = useMemo(() => {
    const createActions = findCreateActions(navBarTree);

    const testDataSources = getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' });
    const renderPreBuiltDashboardAction = testDataSources.length > 0 && config.featureToggles.dashboardTemplates;
    if (renderPreBuiltDashboardAction) {
      createActions.splice(1, 0, {
        id: 'browse-template-dashboard',
        text: 'Dashboard from template',
        url: '/dashboards?templateDashboards=true&source=quickAdd',
        onClick: () => {
          DashboardLibraryInteractions.entryPointClicked({ entryPoint: 'quick_add_button' });
        },
      });
    }

    return createActions;
  }, [navBarTree]);
  const showQuickAdd = createActions.length > 0;

  if (!showQuickAdd) {
    return null;
  }

  const MenuActions = () => {
    return (
      <Menu>
        {createActions.map((createAction, index) => (
          <Menu.Item
            key={index}
            url={createAction.url}
            label={createAction.text}
            onClick={() => {
              reportInteraction('grafana_menu_item_clicked', { url: createAction.url, from: 'quickadd' });
              createAction.onClick?.();
            }}
          />
        ))}
      </Menu>
    );
  };

  return showQuickAdd ? (
    <>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
        <ToolbarButton
          iconOnly
          icon={'plus'}
          isOpen={isOpen}
          aria-label={t('navigation.quick-add.aria-label', 'New')}
        />
      </Dropdown>
      <NavToolbarSeparator />
    </>
  ) : null;
};
