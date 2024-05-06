import React, { useCallback, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Button, ButtonGroup, Dropdown } from '@grafana/ui';
import { createAndCopyDashboardShortLink } from 'app/core/utils/shortLinks';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

import ShareMenu from './ShareMenu';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton;

export default function ShareButton({ dashboard }: { dashboard: DashboardScene }) {
  const [isOpen, setIsOpen] = useState(false);

  const [_, buildUrl] = useAsyncFn(async () => {
    return await createAndCopyDashboardShortLink(dashboard, { useAbsoluteTimeRange: true, theme: 'current' });
  }, [dashboard]);

  const onMenuClick = useCallback((isOpen: boolean) => {
    if (isOpen) {
      DashboardInteractions.toolbarShareClick();
    }

    setIsOpen(isOpen);
  }, []);

  const MenuActions = () => <ShareMenu dashboard={dashboard} />;

  return (
    <ButtonGroup data-testid={newShareButtonSelector.container}>
      <Button data-testid={newShareButtonSelector.shareLink} size="sm" tooltip="Copy shortened URL" onClick={buildUrl}>
        Share
      </Button>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
        <Button data-testid={newShareButtonSelector.arrowMenu} size="sm" icon={isOpen ? 'angle-up' : 'angle-down'} />
      </Dropdown>
    </ButtonGroup>
  );
}
