import React, { useCallback, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { Button, ButtonGroup, ClipboardButton, Dropdown } from '@grafana/ui';
import { createDashboardShortLink } from 'app/core/utils/shortLinks';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

import ShareMenu from './ShareMenu';

export default function ShareButton({ dashboard }: { dashboard: DashboardScene }) {
  const [isOpen, setIsOpen] = useState(false);

  const [_, buildUrl] = useAsyncFn(async () => {
    return await createDashboardShortLink(dashboard, { useAbsoluteTimeRange: true, theme: 'current' });
  }, [dashboard]);

  const getAsyncText = async () => {
    return await buildUrl();
  };

  const onMenuClick = useCallback((isOpen: boolean) => {
    if (isOpen) {
      DashboardInteractions.toolbarShareClick();
    }

    setIsOpen(isOpen);
  }, []);

  const MenuActions = () => <ShareMenu dashboard={dashboard} />;

  return (
    <ButtonGroup>
      <ClipboardButton size="sm" getText={getAsyncText} tooltip="Copy shortened URL">
        Share link
      </ClipboardButton>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
        <Button size="sm" icon={isOpen ? 'angle-up' : 'angle-down'} />
      </Dropdown>
    </ButtonGroup>
  );
}
