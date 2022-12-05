import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { useGetSingle } from './api';

const navId = 'connections-plugin-recipes';

export function PluginRecipeDetailsPage() {
  const params = useParams<{ id: string }>();
  const { status, error, data } = useGetSingle(params.id);
  const tabs = usePluginRecipeDetailsPageTabs();

  // Loading
  if (status === 'loading') {
    return (
      <Page navId={navId} pageNav={{ text: '', subTitle: '', active: true }}>
        <Page.Contents>
          <LoadingPlaceholder text="Loading..." />
        </Page.Contents>
      </Page>
    );
  }

  // Error
  if (status === 'error') {
    return (
      <Page navId={navId} pageNav={{ text: 'Error', subTitle: '', active: true }}>
        <Page.Contents>
          <p>{String(error)}</p>
        </Page.Contents>
      </Page>
    );
  }

  // Not Found
  if (status === 'success' && !data) {
    return (
      <Page navId={navId} pageNav={{ text: '', subTitle: '', active: true }}>
        <Page.Contents>Plugin recipe not found.</Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId={navId} pageNav={{ text: data.name, subTitle: data.description, active: true, children: tabs }}>
      <Page.Contents>
        <div>{params.id}</div>
      </Page.Contents>
    </Page>
  );
}

function usePluginRecipeDetailsPageTabs(): NavModelItem[] {
  const [query, setQueryParams] = useQueryParams();
  const { page } = query;

  return useMemo((): NavModelItem[] => {
    const current = page || 'overview';

    return [
      {
        id: 'overview',
        text: 'Overview',
        onClick: () => setQueryParams({ page: 'overview' }),
        active: current === 'overview',
      },
    ];
  }, [page, setQueryParams]);
}
