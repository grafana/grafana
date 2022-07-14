import { css } from '@emotion/css';
import React, { FC } from 'react';
import { useAsync } from 'react-use';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getGrafanaStorage } from './storage';

export interface Props extends GrafanaRouteComponentProps<{ slug: string }> {}

export const StorageFolderPage: FC<Props> = (props) => {
  const slug = props.match.params.slug;

  const styles = useStyles2(getStyles);
  const listing = useAsync((): Promise<DataFrame | undefined> => {
    return getGrafanaStorage().list(slug);
  }, [slug]);

  let base = document.location.pathname;
  if (!base.endsWith('/')) {
    base += '/';
  }
  let parent = '';
  const idx = base.lastIndexOf('/', base.length - 2);
  if (idx > 0) {
    parent = base.substring(0, idx);
  }

  const renderListing = () => {
    if (listing.value) {
      const names = listing.value.fields[0].values.toArray();
      return names.map((item: string) => {
        let name = item;
        const isFolder = name.indexOf('.') < 0;
        const isDash = !isFolder && name.endsWith('.json');
        return (
          <Card key={name} href={isFolder || isDash ? base + name : undefined}>
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

  return (
    <div className={styles.wrapper}>
      {slug?.length > 0 && (
        <>
          <h1>{slug}</h1>
          <Card href={parent}>
            <Card.Heading>{parent}</Card.Heading>
            <Card.Figure>
              <Icon name="arrow-left" size="sm" />
            </Card.Figure>
          </Card>
          <br />
        </>
      )}
      {renderListing()}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin: 50px;
  `,
});

export default StorageFolderPage;
