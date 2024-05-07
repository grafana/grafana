import React from 'react';

import { Label } from '@grafana/ui';

import { DashboardScene } from '../../../../scene/DashboardScene';
import ShareConfiguration from '../ShareConfiguration';

export default function ConfigPublicSharing({ dashboard }: { dashboard: DashboardScene }) {
  return (
    <>
      <Label>Settings</Label>
      <ShareConfiguration dashboard={dashboard} />
    </>
  );
}
