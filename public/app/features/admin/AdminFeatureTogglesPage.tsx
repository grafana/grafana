import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { useGetFeatureTogglesQuery } from './AdminFeatureTogglesAPI';
import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';

export default function AdminFeatureTogglesPage() {
  const { data: featureToggles, isLoading, isError } = useGetFeatureTogglesQuery();

  const getErrorMessage = () => {
    return 'Error fetching feature toggles';
  };

  return (
    <Page navId="feature-toggles">
      <Page.Contents>
        <>
          {isError && getErrorMessage()}
          {isLoading && 'Fetching feature toggles'}
          {featureToggles && <AdminFeatureTogglesTable featureToggles={featureToggles} />}
        </>
      </Page.Contents>
    </Page>
  );
}
