import React, { FC, useCallback } from 'react';
import { css } from '@emotion/css';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { TagList, Card, useStyles, Icon, IconName } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { DashboardSectionItem, OnToggleChecked } from '../types';
import { SearchCheckbox } from './SearchCheckbox';
import { SEARCH_ITEM_HEIGHT, SEARCH_ITEM_MARGIN } from '../constants';

export interface Props {
  item: DashboardSectionItem;
  editable?: boolean;
  onTagSelected: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
}

const selectors = e2eSelectors.pages.Dashboards;

const getIconFromMeta = (meta = ''): IconName => {
  const metaIconMap = new Map<string, IconName>([
    ['errors', 'info-circle'],
    ['views', 'eye'],
  ]);

  return metaIconMap.has(meta) ? metaIconMap.get(meta)! : 'sort-amount-down';
};

export const SearchItem: FC<Props> = ({ item, editable, onToggleChecked, onTagSelected }) => {
  const styles = useStyles(getStyles);
  const tagSelected = useCallback(
    (tag: string, event: React.MouseEvent<HTMLElement>) => {
      onTagSelected(tag);
    },
    [onTagSelected]
  );

  const toggleItem = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (onToggleChecked) {
        onToggleChecked(item);
      }
    },
    [item, onToggleChecked]
  );

  const folderTitle = item.folderTitle || 'General';
  return (
    <Card
      aria-label={selectors.dashboards(item.title)}
      heading={item.title}
      href={item.url}
      style={{ minHeight: SEARCH_ITEM_HEIGHT }}
      className={styles.container}
    >
      <Card.Figure align={'center'} className={styles.checkbox}>
        <SearchCheckbox editable={editable} checked={item.checked} onClick={toggleItem} />
      </Card.Figure>
      <Card.Meta separator={''}>
        <span className={styles.metaContainer}>
          <Icon name={'folder'} />
          {folderTitle}
        </span>
        {item.sortMetaName && (
          <span className={styles.metaContainer}>
            <Icon name={getIconFromMeta(item.sortMetaName)} />
            {item.sortMeta} {item.sortMetaName}
          </span>
        )}
      </Card.Meta>
      <Card.Tags>
        <TagList tags={item.tags} onClick={tagSelected} />
      </Card.Tags>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      margin-bottom: ${SEARCH_ITEM_MARGIN}px;

      a {
        padding: ${theme.spacing.sm} ${theme.spacing.md};
      }
    `,
    metaContainer: css`
      display: flex;
      align-items: center;
      margin-right: ${theme.spacing.sm};

      svg {
        margin-right: ${theme.spacing.xs};
        margin-bottom: 0;
      }
    `,
    checkbox: css`
      margin-right: 0;
    `,
  };
};
