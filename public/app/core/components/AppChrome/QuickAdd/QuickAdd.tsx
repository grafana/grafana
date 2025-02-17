import { useMemo, useState } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { Menu, Dropdown, Button, Icon, Box } from '@grafana/ui';
import { useSelector } from 'app/types';

import { findCreateActions } from './utils';

export interface Props {}

export const QuickAdd = ({}: Props) => {
  const navBarTree = useSelector((state) => state.navBarTree);

  const [isOpen, setIsOpen] = useState(false);
  const createActions = useMemo(() => findCreateActions(navBarTree), [navBarTree]);

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

  return (
    <Box paddingX={2} paddingTop={2} paddingBottom={0.5} display={'flex'} alignItems={'center'}>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
        <Button variant="secondary" icon={'plus'} aria-label="New" fullWidth>
          New <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </Button>
      </Dropdown>
    </Box>
  );
};
