import React, { FC, useCallback } from 'react';
import { css } from '@emotion/css';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { TagList, Card, Icon, IconName, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { DashboardSectionItem, OnToggleChecked } from '../types';
import { SearchCheckbox } from './SearchCheckbox';
import { SEARCH_ITEM_HEIGHT } from '../constants';

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
  const styles = useStyles2(getStyles);
  const tagSelected = useCallback(
    (tag: string, event: React.MouseEvent<HTMLElement>) => {
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
      aria-label={selectors.dashboards(item.title)}
      heading={item.title}
      href={item.url}
      style={{ minHeight: SEARCH_ITEM_HEIGHT }}
      className={styles.container}
    >
      <Card.Figure align={'center'} className={styles.checkbox}>
        <SearchCheckbox editable={editable} checked={item.checked} onClick={handleCheckboxClick} />
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      margin-bottom: ${theme.spacing(0.75)};

      a {
        padding: ${theme.spacing(1)} ${theme.spacing(2)};
      }
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
