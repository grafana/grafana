import React, { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';

const getToggles = async () => {
  return await getBackendSrv().get('/api/featuremgmt');
};

const getErrorMessage = (error: Error) => {
  return isFetchError(error) ? error?.data?.message : 'An unexpected error happened.';
};

export default function AdminFeatureTogglesPage() {
  const [state, fetchToggles] = useAsyncFn(async () => await getToggles(), []);

  useEffect(() => {
    fetchToggles();
  }, [fetchToggles]);

  return (
    <Page navId="feature-toggles">
      <Page.Contents>
        <>
          {state.error && getErrorMessage(state.error)}
          {state.loading && 'Fetching feature toggles'}
          {state.value && <AdminFeatureTogglesTable featureToggles={state.value} />}
        </>
      </Page.Contents>
    </Page>
  );
}
