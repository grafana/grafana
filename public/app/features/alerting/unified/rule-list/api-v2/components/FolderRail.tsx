import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, Input, useStyles2 } from '@grafana/ui';

import { shouldAllowRecoveringDeletedRules } from '../../../featureToggles';
import { type SelectedView, type TreeModel } from '../lib/types';

import { FolderList } from './FolderList';

interface Props {
  tree: TreeModel;
  view: SelectedView;
  onSelectFolder: (dataSourceUid: string, folderKey: string) => void;
  onSelectDeleted: () => void;
}

const RAIL_WIDTH = 260;

export function FolderRail({ tree, view, onSelectFolder, onSelectDeleted }: Props) {
  const styles = useStyles2(getStyles);
  const [filterText, setFilterText] = useState('');

  const firingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ds of tree.dataSources) {
      for (const folder of ds.folders) {
        let firing = 0;
        for (const group of folder.groups) {
          for (const rule of group.rules) {
            if (rule.type === 'alerting' && rule.state === 'firing') {
              firing += 1;
            }
          }
        }
        counts.set(`${ds.uid}:${folder.key}`, firing);
      }
    }
    return counts;
  }, [tree]);

  const deletedAllowed = shouldAllowRecoveringDeletedRules();

  return (
    <aside className={styles.rail} style={{ width: RAIL_WIDTH }}>
      <div className={styles.filterInputWrap}>
        <Input
          placeholder={t('alerting.rule-list-v2.filter-folders', 'Filter folders...')}
          value={filterText}
          onChange={(e) => setFilterText(e.currentTarget.value)}
          prefix={<Icon name="search" />}
        />
      </div>
      <div className={styles.treeWrap}>
        <FolderList
          dataSources={tree.dataSources}
          selected={view.kind === 'folder' ? view.folder : undefined}
          filterText={filterText}
          onSelect={onSelectFolder}
          firingCounts={firingCounts}
        />
      </div>
      {deletedAllowed && (
        <>
          <div className={styles.divider} />
          <button
            type="button"
            onClick={onSelectDeleted}
            className={styles.deletedRow}
            aria-pressed={view.kind === 'deleted'}
          >
            <Icon name="trash-alt" />
            <span>
              <Trans i18nKey="alerting.rule-list-v2.recently-deleted">Recently deleted</Trans>
            </span>
          </button>
        </>
      )}
    </aside>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rail: css({
      position: 'sticky',
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1, 0),
      flexShrink: 0,
      alignSelf: 'flex-start',
      maxHeight: '100vh',
      marginRight: theme.spacing(2),
    }),
    filterInputWrap: css({
      padding: theme.spacing(1),
    }),
    treeWrap: css({
      overflowY: 'auto',
      flex: 1,
    }),
    divider: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(1, 0),
    }),
    deletedRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 1),
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.text.primary,
      textAlign: 'left',
      borderLeft: '2px solid transparent',
      fontSize: theme.typography.bodySmall.fontSize,
      '&[aria-pressed="true"]': {
        background: theme.colors.background.secondary,
        borderLeftColor: theme.colors.primary.main,
      },
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
  };
}
