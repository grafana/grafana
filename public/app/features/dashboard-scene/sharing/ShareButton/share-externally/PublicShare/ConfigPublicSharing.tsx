import React from 'react';

import { Text } from '@grafana/ui';

import { DashboardScene } from '../../../../scene/DashboardScene';
import ShareConfiguration from '../ShareConfiguration';

export default function ConfigPublicSharing({ dashboard }: { dashboard: DashboardScene }) {
  return (
    <>
      <Text element="p">Settings</Text>
      <ShareConfiguration dashboard={dashboard} />
    </>
  );
}
