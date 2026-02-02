import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Icon, IconButton, Link, Spinner, Text, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { t } from 'app/core/internationalization';
import { getIconForItem } from 'app/features/search/service/utils';

import { Indent } from '../../../core/components/Indent/Indent';
import { useChildrenByParentUIDState } from '../state';
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

  // BMC code - localized dashboard/folder names
  // to be ignored for extraction
  const localizedTitle = t(`bmc-dynamic.${item.uid}.name`, (item as any).title);

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
              No items
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
          onClick={(event) => {
            // BMC code: fix for regression caused by accessibility changes
            // this was causing the click event to bubble up to the row
            // and trigger the row click event
            // on row click, we are toggling the selection state of the item.
            event.preventDefault();
            event.stopPropagation();
            // BMC code: end
            onFolderClick(item.uid, !isOpen);
          }}
          name={isOpen ? 'angle-down' : 'angle-right'}
          aria-label={
            isOpen
              ? t('browse-dashboards.dashboards-tree.collapse-folder-button', 'Collapse folder {{title}}', {
                  title: localizedTitle,
                })
              : t('browse-dashboards.dashboards-tree.expand-folder-button', 'Expand folder {{title}}', {
                  title: localizedTitle,
                })
          }
          // BMC Accessibility Change: Added aria-expanded
          aria-expanded={isOpen ? 'true' : 'false'}
          // BMC Accessibility Change End
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
              {localizedTitle}
            </Link>
          ) : (
            localizedTitle
          )}
        </Text>
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
