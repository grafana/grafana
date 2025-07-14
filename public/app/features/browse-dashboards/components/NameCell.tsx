import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Icon, IconButton, Link, Spinner, useStyles2, Text } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/internal';
import { getIconForItem } from 'app/features/search/service/utils';

import { Indent } from '../../../core/components/Indent/Indent';
import { FolderRepo } from '../../../core/components/NestedFolderPicker/FolderRepo';
import { useChildrenByParentUIDState } from '../state/hooks';
import { DashboardsTreeCellProps } from '../types';

import { makeRowID } from './utils';

const CHEVRON_SIZE = 'md';
const ICON_SIZE = 'sm';

type NameCellProps = DashboardsTreeCellProps & {
  onFolderClick: (uid: string, newOpenState: boolean) => void;
};

export function NameCell({ row: { original: data }, onFolderClick, treeID }: NameCellProps) {
  const styles = useStyles2(getStyles);
  const { item, level, isOpen } = data;
  const childrenByParentUID = useChildrenByParentUIDState();

  const isLoading = isOpen && !childrenByParentUID[item.uid];
  const iconName = getIconForItem(data.item, isOpen);

  if (item.kind === 'ui') {
    return (
      <>
        <Indent
          level={level}
          spacing={{
            xs: 1,
            md: 3,
          }}
        />
        <span className={styles.folderButtonSpacer} />
        {item.uiKind === 'empty-folder' ? (
          <em className={styles.emptyText}>
            <Text variant="body" color="secondary" truncate>
              <Trans i18nKey="browse-dashboards.name-cell.no-items">No items</Trans>
            </Text>
          </em>
        ) : (
          <Skeleton width={200} />
        )}
      </>
    );
  }

  return (
    <>
      <Indent
        level={level}
        spacing={{
          xs: 1,
          md: 3,
        }}
      />

      {item.kind === 'folder' ? (
        <IconButton
          size={CHEVRON_SIZE}
          className={styles.chevron}
          onClick={() => {
            onFolderClick(item.uid, !isOpen);
          }}
          name={isOpen ? 'angle-down' : 'angle-right'}
          aria-label={
            isOpen
              ? t('browse-dashboards.dashboards-tree.collapse-folder-button', 'Collapse folder {{title}}', {
                  title: item.title,
                })
              : t('browse-dashboards.dashboards-tree.expand-folder-button', 'Expand folder {{title}}', {
                  title: item.title,
                })
          }
        />
      ) : (
        <span className={styles.folderButtonSpacer} />
      )}

      <div className={styles.iconNameContainer}>
        {isLoading ? <Spinner size={ICON_SIZE} /> : <Icon size={ICON_SIZE} name={iconName} />}

        <Text variant="body" truncate id={treeID && makeRowID(treeID, item)}>
          {item.url ? (
            <Link
              onClick={() => {
                reportInteraction('manage_dashboards_result_clicked');
              }}
              href={item.url}
              className={styles.link}
            >
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </Text>

        <FolderRepo folder={item} />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    chevron: css({
      marginRight: theme.spacing(1),
      width: getSvgSize(CHEVRON_SIZE),
    }),
    emptyText: css({
      // needed for text to truncate correctly
      overflow: 'hidden',
    }),
    // Should be the same size as the <IconButton /> so Dashboard name is aligned to Folder name siblings
    folderButtonSpacer: css({
      paddingLeft: `calc(${getSvgSize(CHEVRON_SIZE)}px + ${theme.spacing(1)})`,
    }),
    iconNameContainer: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
      overflow: 'hidden',
    }),
    link: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
