import React from 'react';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { Page as CloudPage } from './cloud/Page';
import { Page as OnPremPage } from './onprem/Page';

export default function MigrateToCloud() {
  // TODO replace this with a proper config value when it's available
  const isMigrationTarget = config.namespace.startsWith('stack-');

  return <Page navId="migrate-to-cloud">{isMigrationTarget ? <CloudPage /> : <OnPremPage />}</Page>;
}
