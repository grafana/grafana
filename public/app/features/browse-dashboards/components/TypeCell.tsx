import { css } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { Span } from '@grafana/ui/src/unstable';
import { Trans } from 'app/core/internationalization';
import { getIconForKind } from 'app/features/search/service/utils';

import { DashboardsTreeItem } from '../types';

export function TypeCell({ row: { original: data } }: CellProps<DashboardsTreeItem, unknown>) {
  const iconName = getIconForKind(data.item.kind);
  const styles = useStyles2(getStyles);

  switch (data.item.kind) {
    case 'dashboard':
      return (
        <div className={styles.container}>
          <Icon name={iconName} />
          <Span variant="body" color="secondary" truncate>
            <Trans i18nKey="browse-dashboards.type-cell.dashboard">Dashboard</Trans>
          </Span>
        </div>
      );
    case 'folder':
      return (
        <div className={styles.container}>
          <Icon name={iconName} />
          <Span variant="body" color="secondary" truncate>
            <Trans i18nKey="browse-dashboards.type-cell.folder">Folder</Trans>
          </Span>
        </div>
      );
    case 'panel':
      return (
        <div className={styles.container}>
          <Icon name={iconName} />
          <Span variant="body" color="secondary" truncate>
            <Trans i18nKey="browse-dashboards.type-cell.panel">Panel</Trans>
          </Span>
        </div>
      );
    case 'ui':
      return data.item.uiKind === 'empty-folder' ? null : <Skeleton width={100} />;
    default:
      return null;
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'nowrap',
    gap: theme.spacing(0.5),
    // needed for text to truncate correctly
    overflow: 'hidden',
  }),
});
