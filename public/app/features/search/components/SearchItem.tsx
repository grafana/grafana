import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Card, Icon, IconName, TagList, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { SEARCH_ITEM_HEIGHT } from '../constants';
import { getIconForKind } from '../service/utils';
import { DashboardViewItem, OnToggleChecked } from '../types';

import { SearchCheckbox } from './SearchCheckbox';

export interface Props {
  item: DashboardViewItem;
  isSelected?: boolean;
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
export const SearchItem = ({ item, isSelected, editable, onToggleChecked, onTagSelected, onClickItem }: Props) => {
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

      if (onToggleChecked) {
        onToggleChecked(item);
      }
    },
    [item, onToggleChecked]
  );

  const description = config.featureToggles.nestedFolders ? (
    <>
      <Icon name={getIconForKind(item.kind)} aria-hidden /> {kindName(item.kind)}
    </>
  ) : (
    <>
      <Icon name={getIconForKind(item.parentKind ?? 'folder')} aria-hidden /> {item.parentTitle || 'General'}
    </>
  );

  return (
    <li className={styles.cardContainer}>
      <SearchCheckbox
        aria-label="Select dashboard"
        editable={editable}
        checked={isSelected}
        onClick={handleCheckboxClick}
      />

      <Card
        className={styles.card}
        data-testid={selectors.dashboardItem(item.title)}
        href={item.url}
        style={{ minHeight: SEARCH_ITEM_HEIGHT }}
        onClick={onClickItem}
      >
        <Card.Heading>{item.title}</Card.Heading>

        <Card.Meta separator={''}>
          <span className={styles.metaContainer}>{description}</span>

          {item.sortMetaName && (
            <span className={styles.metaContainer}>
              <Icon name={getIconFromMeta(item.sortMetaName)} />
              {item.sortMeta} {item.sortMetaName}
            </span>
          )}
        </Card.Meta>
        <Card.Tags>
          <TagList tags={item.tags ?? []} onClick={tagSelected} getAriaLabel={(tag) => `Filter by tag "${tag}"`} />
        </Card.Tags>
      </Card>
    </li>
  );
};

function kindName(kind: DashboardViewItem['kind']) {
  switch (kind) {
    case 'folder':
      return t('search.result-kind.folder', 'Folder');
    case 'dashboard':
      return t('search.result-kind.dashboard', 'Dashboard');
    case 'panel':
      return t('search.result-kind.panel', 'Panel');
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardContainer: css`
      display: flex;
      list-style: none;
      align-items: center;
      margin-bottom: ${theme.spacing(0.75)};
    `,
    card: css`
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      margin-bottom: 0;
    `,
    metaContainer: css`
      display: flex;
      align-items: center;
      margin-right: ${theme.spacing(1)};

      svg {
        margin-right: ${theme.spacing(0.5)};
      }
    `,
  };
};
