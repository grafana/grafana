import React from 'react';
import { useAsync } from 'react-use';

import { DataFrame, NavModel, NavModelItem, DataFrameView } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Card, Icon, Spinner } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getGrafanaStorage } from './storage';
import { ListItem } from './types';

export interface Props extends GrafanaRouteComponentProps<{ slug: string }> {}

export function StorageFolderPage(props: Props) {
  let slug = props.match.params.slug ?? '';
  const listing = useAsync((): Promise<DataFrame | undefined> => {
    return getGrafanaStorage().list('drive/' + slug);
  }, [slug]);

  const pageNav = getPageNavFromSlug(slug);

  const renderListing = () => {
    if (listing.value) {
      if (listing.value.length < 1) {
        return <div>Empty folder</div>;
      }

      const view = new DataFrameView<ListItem>(listing.value);
      return view.map((item: ListItem) => {
        let url = `g/${item.uid}`;
        const isFolder = item.kind === 'folder';
        const isDash = item.kind === 'dashboard';
        if (isDash) {
          url = `x-dash/${item.uid}`;
        }

        return (
          <Card key={url} href={isFolder || isDash ? url : undefined}>
            <Card.Heading>{item.name}</Card.Heading>
            <Card.Figure>
              <Icon name={isFolder ? 'folder' : isDash ? 'gf-grid' : 'file-alt'} size="sm" />
            </Card.Figure>
          </Card>
        );
      });
    }
    if (listing.loading) {
      return <Spinner />;
    }
    return <div>?</div>;
  };

  const navModel = getRootContentNavModel();

  return (
    <Page navModel={navModel} pageNav={pageNav}>
      {!config.featureToggles.topnav && (
        <div>
          <Alert title="Enable the topnav feature toggle">This page is designed assuming topnav is enabled</Alert>
        </div>
      )}
      {renderListing()}
    </Page>
  );
}

export function getPageNavFromSlug(slug: string) {
  const parts = slug.split('/');
  let pageNavs: NavModelItem[] = [];
  let url = 'g';
  let lastPageNav: NavModelItem | undefined;

  for (let i = 0; i < parts.length; i++) {
    url += `/${parts[i]}`;
    pageNavs.push({ text: parts[i], url, parentItem: lastPageNav });
    lastPageNav = pageNavs[pageNavs.length - 1];
  }

  return lastPageNav;
}

export function getRootContentNavModel(): NavModel {
  return { main: { text: 'C:' }, node: { text: 'Content', url: '/g' } };
}

export default StorageFolderPage;
