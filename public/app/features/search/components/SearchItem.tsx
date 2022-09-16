import { css } from '@emotion/css';
import React, { FC, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Card, Icon, IconName, TagList, useStyles2 } from '@grafana/ui';

import { SEARCH_ITEM_HEIGHT } from '../constants';
import { DashboardSectionItem, OnToggleChecked } from '../types';

import { SearchCheckbox } from './SearchCheckbox';

export interface Props {
  item: DashboardSectionItem;
  editable?: boolean;
  onTagSelected: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
  onClickItem?: (event: React.MouseEvent<HTMLElement>) => void;
}

const selectors = e2eSelectors.components.Search;

const getIconFromMeta = (meta = ''): IconName => {
  const metaIconMap = new Map<string, IconName>([
    ['errors', 'info-circle'],
    ['views', 'eye'],
  ]);

  return metaIconMap.has(meta) ? metaIconMap.get(meta)! : 'sort-amount-down';
};

/** @deprecated */
export const SearchItem: FC<Props> = ({ item, editable, onToggleChecked, onTagSelected, onClickItem }) => {
  const styles = useStyles2(getStyles);
  const tagSelected = useCallback(
    (tag: string, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      event.preventDefault();
      onTagSelected(tag);
    },
    [onTagSelected]
  );

  const handleCheckboxClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();

      if (onToggleChecked) {
        onToggleChecked(item);
      }
    },
    [item, onToggleChecked]
  );

  const folderTitle = item.folderTitle || 'General';
  return (
    <Card
      data-testid={selectors.dashboardItem(item.title)}
      href={item.url}
      style={{ minHeight: SEARCH_ITEM_HEIGHT }}
      className={styles.container}
      onClick={onClickItem}
    >
      <Card.Heading>{item.title}</Card.Heading>
      <Card.Figure align={'center'} className={styles.checkbox}>
        <SearchCheckbox
          aria-label="Select dashboard"
          editable={editable}
          checked={item.checked}
          onClick={handleCheckboxClick}
        />
      </Card.Figure>
      <Card.Meta separator={''}>
        <span className={styles.metaContainer}>
          <Icon name={'folder'} aria-hidden />
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
        <TagList tags={item.tags} onClick={tagSelected} getAriaLabel={(tag) => `Filter by tag "${tag}"`} />
      </Card.Tags>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      margin-bottom: ${theme.spacing(0.75)};
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
    `,
    metaContainer: css`
      display: flex;
      align-items: center;
      margin-right: ${theme.spacing(1)};

      svg {
        margin-right: ${theme.spacing(0.5)};
      }
    `,
    checkbox: css`
      margin-right: 0;
    `,
  };
};
