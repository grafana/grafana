import { useParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { DataFrame, NavModel, NavModelItem } from '@grafana/data';
import { Card, Icon, Spinner } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { getGrafanaStorage } from './storage';

export function StorageFolderPage() {
  const { slug = '' } = useParams();
  const listing = useAsync((): Promise<DataFrame | undefined> => {
    return getGrafanaStorage().list('content/' + slug);
  }, [slug]);

  const childRoot = slug.length > 0 ? `g/${slug}/` : 'g/';
  const pageNav = getPageNavFromSlug(slug);

  const renderListing = () => {
    if (listing.value) {
      const names = listing.value.fields[0].values;
      return names.map((item: string) => {
        let name = item;
        const isFolder = name.indexOf('.') < 0;
        const isDash = !isFolder && name.endsWith('.json');
        const url = `${childRoot}${name}`;

        return (
          <Card key={name} href={isFolder || isDash ? url : undefined}>
            <Card.Heading>{name}</Card.Heading>
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
