import React from 'react';

import { Page } from 'app/core/components/Page/Page';
import config from 'app/core/config';

import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';

type FeatureToggle = {
  name: string;
  enabled: boolean;
};

export default function AdminFeatureTogglesPage() {
  const featureToggles: FeatureToggle[] = Object.keys(config.featureToggles).map((name) => {
    return {
      name,
      enabled: true,
    };
  });

  return (
    <Page navId="feature-toggles">
      <Page.Contents>
        <>
          <AdminFeatureTogglesTable featureToggles={featureToggles} />
        </>
      </Page.Contents>
    </Page>
  );
}
