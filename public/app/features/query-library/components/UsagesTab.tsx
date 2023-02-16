import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Button, Card, Icon, IconName, Spinner, useStyles2 } from '@grafana/ui/src';

import { HorizontalGroup } from '../../plugins/admin/components/HorizontalGroup';
import { getGrafanaSearcher, SearchQuery } from '../../search/service';
import { SavedQuery } from '../api/SavedQueriesApi';
import { QueryItem } from '../types';

type Props = {
  savedQuery: SavedQuery;
};

export const UsagesTab = ({ savedQuery }: Props) => {
  const styles = useStyles2(getStyles);

  const searchQuery = useMemo<SearchQuery>(() => {
    const query: SearchQuery = {
      query: '*',
      kind: savedQuery.uid ? ['dashboard', 'alert'] : ['newQuery'], // workaround for new queries
      saved_query_uid: savedQuery.uid,
    };

    return query;
  }, [savedQuery.uid]);

  const results = useAsync(async () => {
    const raw = await getGrafanaSearcher().search(searchQuery);
    return raw.view.map<QueryItem>((item) => ({
      uid: item.uid,
      title: item.name,
      url: item.url,
      uri: item.url,
      type: item.kind,
      id: 321, // do not use me!
      tags: item.tags ?? [],
      ds_uid: item.ds_uid,
      location: item.location,
      panel_type: item.panel_type,
    }));
  }, [searchQuery]);

  if (results.loading) {
    return <Spinner />;
  }

  const found = results.value;

  const getIconForKind = (kind: string): IconName => {
    let icon: IconName = 'question-circle';
    switch (kind) {
      case 'dashboard':
        icon = 'apps';
        break;
      case 'folder':
        icon = 'folder';
        break;
      case 'alert':
        icon = 'bell';
        break;
      default:
        icon = 'question-circle';
        break;
    }

    return icon;
  };

  if (found?.length === 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.usagesDescription}>This query is not used anywhere.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.usagesDescription}>
        This query is used in the places below. Modifying will affect all its usages.
      </p>
      {found?.map((item) => {
        return (
          <div key={item.uid}>
            <Card>
              <Card.Heading>
                <span className={styles.cardHeading}>
                  {item.title}
                  <a
                    href={item.url}
                    title={'Open in new tab'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.externalLink}
                  >
                    <Icon name="external-link-alt" className={styles.cardHeadingIcon} />
                  </a>
                </span>
              </Card.Heading>
              <Card.Description>
                <a href={'dashboards'} target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
                  <Icon name="folder" className={styles.cardDescriptionIcon} />
                </a>
                {item.location}
              </Card.Description>
              <Card.Figure className={styles.cardFigure}>
                <Icon name={getIconForKind(item.type)} />
              </Card.Figure>
              <Card.Tags>
                <HorizontalGroup>
                  <Button icon="eye" size="sm" variant={'secondary'} />
                  <Button icon="link" size="sm" variant={'secondary'}>
                    Unlink
                  </Button>
                </HorizontalGroup>
              </Card.Tags>
            </Card>
          </div>
        );
      })}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css`
      padding: 20px 5px 5px 5px;
    `,
    info: css`
      padding-bottom: 30px;
    `,
    folderIcon: css`
      margin-right: 5px;
    `,
    cardFigure: css`
      margin-right: 0;
      margin-top: 15px;
    `,
    externalLink: css`
      margin-left: 5px;
    `,
    cardHeading: css`
      display: flex;
    `,
    cardHeadingIcon: css`
      width: 13px;
      height: 13px;
      color: ${theme.colors.text.secondary};
      display: flex;
      align-self: center;
    `,
    usagesDescription: css`
      color: ${theme.colors.text.secondary};
    `,
    cardDescriptionIcon: css`
      width: 16px;
      height: 16px;
      color: ${theme.colors.text.secondary};
      margin-right: 5px;
    `,
  };
};
