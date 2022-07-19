import { css } from '@emotion/css';
import React, { FC } from 'react';
import { useAsync } from 'react-use';

import { DataFrame, GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Card, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getGrafanaStorage } from './storage';

export interface Props extends GrafanaRouteComponentProps<{ slug: string }> {}

export const StorageFolderPage: FC<Props> = (props) => {
  const slug = props.match.params.slug ?? '';

  const styles = useStyles2(getStyles);
  const listing = useAsync((): Promise<DataFrame | undefined> => {
    return getGrafanaStorage().list(slug);
  }, [slug]);

  const childRoot = slug.length > 0 ? `g/${slug}/` : 'g/';
  const pageNav = getPageNav(slug);

  const renderListing = () => {
    if (listing.value) {
      const names = listing.value.fields[0].values.toArray();
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

  const navModel = { main: { text: 'Content' }, node: { text: 'Content' } };

  return (
    <Page navModel={navModel} pageNav={pageNav}>
      {renderListing()}
    </Page>
  );
};

function getPageNav(slug: string) {
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

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak} `,
    borderRadius: theme.shape.borderRadius(1),
    padding: theme.spacing(2),
  }),
});

export default StorageFolderPage;
