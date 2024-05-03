import React from 'react';
import { useAsyncFn } from 'react-use';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';

import { createAndCopyDashboardShortLink } from '../../../../core/utils/shortLinks';
import { DashboardScene } from '../../scene/DashboardScene';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

export default function ShareMenu({ dashboard }: { dashboard: DashboardScene }) {
  const [_, buildUrl] = useAsyncFn(async () => {
    return await createAndCopyDashboardShortLink(dashboard, { useAbsoluteTimeRange: true, theme: 'current' });
  }, [dashboard]);

  return (
    <Menu data-testid={newShareButtonSelector.container}>
      <Menu.Item
        testId={newShareButtonSelector.shareInternally}
        label="Share internally"
        description="Copy link"
        icon="building"
        onClick={buildUrl}
      />
    </Menu>
  );
}
