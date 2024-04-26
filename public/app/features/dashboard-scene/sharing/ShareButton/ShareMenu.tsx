import React from 'react';
import { useAsyncFn } from 'react-use';

import { Menu } from '@grafana/ui';

import { createAndCopyDashboardShortLink } from '../../../../core/utils/shortLinks';
import { DashboardScene } from '../../scene/DashboardScene';

export default function ShareMenu({ dashboard }: { dashboard: DashboardScene }) {
  const [_, buildUrl] = useAsyncFn(async () => {
    return await createAndCopyDashboardShortLink(dashboard, { useAbsoluteTimeRange: true, theme: 'current' });
  }, [dashboard]);

  return (
    <Menu>
      <Menu.Item label="Share internally" description="Copy link" icon="building" onClick={buildUrl} />
    </Menu>
  );
}
