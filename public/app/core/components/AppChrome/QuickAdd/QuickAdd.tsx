import { useMemo, useState } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { Menu, Dropdown, ToolbarButton } from '@grafana/ui';
import { getExternalUserMngLinkUrl } from 'app/features/users/utils';
import { useSelector } from 'app/types';

import { t } from '../../../internationalization';
import { performInviteUserClick, shouldRenderInviteUserButton } from '../../InviteUserButton/utils';
import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { findCreateActions } from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const navBarTree = useSelector((state) => state.navBarTree);
  const [isOpen, setIsOpen] = useState(false);
  const createActions = useMemo(() => {
    const actions = findCreateActions(navBarTree);

    if (shouldRenderInviteUserButton) {
      actions.push({
        text: t('navigation.invite-user.invite-new-member-button', 'Invite new member'),
        url: getExternalUserMngLinkUrl('invite-user-top-bar'),
        target: '_blank',
        isCreateAction: true,
        onClick: () => {
          performInviteUserClick('quick_add_button', 'invite-user-quick-add-button');
        },
      });
    }

    return actions;
  }, [navBarTree]);
  const showQuickAdd = createActions.length > 0;

  if (!showQuickAdd) {
    return null;
  }

  const MenuActions = () => {
    return (
      <Menu>
        {createActions.map((createAction, index) => (
          <div key={index}>
            {shouldRenderInviteUserButton && index === createActions.length - 1 && <Menu.Divider />}
            <Menu.Item
              url={createAction.url}
              label={createAction.text}
              target={createAction.target}
              onClick={() => {
                reportInteraction('grafana_menu_item_clicked', { url: createAction.url, from: 'quickadd' });
                createAction.onClick?.();
              }}
            />
          </div>
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
