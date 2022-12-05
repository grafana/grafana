import React from 'react';
import { useParams } from 'react-router-dom';

import { LoadingPlaceholder } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetSingle } from './api';
import { DetailsOverview } from './components';
import { tabIds, usePluginRecipeDetailsPageTabs } from './hooks';

const navId = 'connections-plugin-recipes';

export function PluginRecipeDetailsPage() {
  const params = useParams<{ id: string }>();
  const { status, error, data } = useGetSingle(params.id);
  const { tabId, tabs } = usePluginRecipeDetailsPageTabs(data);

  if (status === 'loading') {
    return (
      <Page navId={navId} pageNav={{ text: '', subTitle: '', active: true }}>
        <Page.Contents>
          <LoadingPlaceholder text="Loading..." />
        </Page.Contents>
      </Page>
    );
  }

  if (status === 'error') {
    return (
      <Page navId={navId} pageNav={{ text: 'Error', subTitle: '', active: true }}>
        <Page.Contents>
          <p>{String(error)}</p>
        </Page.Contents>
      </Page>
    );
  }

  if (status === 'success' && !data) {
    return (
      <Page navId={navId} pageNav={{ text: '', subTitle: '', active: true }}>
        <Page.Contents>Plugin recipe not found.</Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId={navId} pageNav={{ text: data.name, subTitle: data.description, active: true, children: tabs }}>
      <Page.Contents>{tabId === tabIds.overview && <DetailsOverview recipe={data} />}</Page.Contents>
    </Page>
  );
}
