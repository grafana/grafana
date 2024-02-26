import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { EmptyState } from './onprem/EmptyState/EmptyState';

export default function MigrateToCloud() {
  return (
    <Page navId="migrate-to-cloud">
      <EmptyState />
    </Page>
  );
}
