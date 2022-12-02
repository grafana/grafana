import * as React from 'react';
import { useParams } from 'react-router-dom';

import { LoadingPlaceholder } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetSingle } from './api';

export function PluginRecipeDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { status, error, isFetching, data } = useGetSingle(id);

  // Loading
  if (isFetching) {
    return (
      <Page navId={'connections-plugin-recipes'} pageNav={{ text: '', subTitle: '', active: true }}>
        <Page.Contents>
          <LoadingPlaceholder text="Loading..." />
        </Page.Contents>
      </Page>
    );
  }

  // Error
  if (error) {
    return (
      <Page navId={'connections-plugin-recipes'} pageNav={{ text: 'Error', subTitle: '', active: true }}>
        <Page.Contents>
          <p>{String(error)}</p>
        </Page.Contents>
      </Page>
    );
  }

  // Not Found
  if (!data) {
    return (
      <Page navId={'connections-plugin-recipes'} pageNav={{ text: '', subTitle: '', active: true }}>
        <Page.Contents>Plugin recipe not found.</Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId={'connections-plugin-recipes'} pageNav={{ text: data.name, subTitle: data.description, active: true }}>
      <Page.Contents>
        <div>{id}</div>
      </Page.Contents>
    </Page>
  );
}
