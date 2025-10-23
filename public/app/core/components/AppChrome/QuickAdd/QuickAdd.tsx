import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Menu, Dropdown, ToolbarButton } from '@grafana/ui';
import { useSelector } from 'app/types/store';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { findCreateActions } from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const navBarTree = useSelector((state) => state.navBarTree);
  const [isOpen, setIsOpen] = useState(false);

  const createActions = useMemo(() => {
    const createActions = findCreateActions(navBarTree);
    return [
      ...createActions,
      {
        id: 'create-template',
        text: 'Create dashboard from template',
        url: '/dashboards?templateDashboards=true',
        icon: 'template',
        onClick: () => {
          reportInteraction('grafana_menu_item_clicked', { url: '/dashboard/new?template=true', from: 'quickadd' });
        },
      },
    ];
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
            onClick={() => reportInteraction('grafana_menu_item_clicked', { url: createAction.url, from: 'quickadd' })}
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
