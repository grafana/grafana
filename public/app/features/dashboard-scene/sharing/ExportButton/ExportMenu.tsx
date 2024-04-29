import React from 'react';
// import { useAsyncFn } from 'react-use';

import { Menu } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';

export default function ExportMenu({ dashboard }: { dashboard: DashboardScene }) {
  return (
    <Menu>
      <Menu.Item label="Export as PDF" icon="file-alt" />
      <Menu.Item label="Export as JSON" icon="file-alt" />
    </Menu>
  );
}
