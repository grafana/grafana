import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { useFolderListKeyboard } from '../hooks/useFolderListKeyboard';
import { type SelectedFolder, type TreeDataSource } from '../lib/types';

import { FolderListRow } from './FolderListRow';

interface Props {
  dataSources: TreeDataSource[];
  selected?: SelectedFolder;
  filterText: string;
  onSelect: (dataSourceUid: string, folderKey: string) => void;
  firingCounts: Map<string, number>;
}

export function FolderList({ dataSources, selected, filterText, onSelect, firingCounts }: Props) {
  const styles = useStyles2(getStyles);

  const flatKeys = useMemo(() => {
    const keys: string[] = [];
    for (const ds of dataSources) {
      for (const folder of ds.folders) {
        if (matchesFilter(folder.title, filterText)) {
          keys.push(`${ds.uid}:${folder.key}`);
        }
      }
    }
    return keys;
  }, [dataSources, filterText]);

  const activeKey = selected ? `${selected.dataSourceUid}:${selected.folderKey}` : undefined;
  const [focusKey, setFocusKey] = useState<string | undefined>(activeKey);
  const effectiveFocusKey = focusKey && flatKeys.includes(focusKey) ? focusKey : (activeKey ?? flatKeys[0]);

  const { onKeyDown } = useFolderListKeyboard({
    flatKeys,
    activeKey: effectiveFocusKey,
    onActivate: (key) => {
      setFocusKey(key);
      const [dsUid, folderKey] = splitKey(key);
      onSelect(dsUid, folderKey);
    },
  });

  return (
    <div
      role="tree"
      aria-label={t('alerting.rule-list-v2.folders-tree', 'Folders')}
      className={styles.tree}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {dataSources.map((ds) => (
        <DataSourceSection
          key={ds.uid}
          ds={ds}
          filterText={filterText}
          activeKey={activeKey}
          focusKey={effectiveFocusKey}
          onSelect={onSelect}
          firingCounts={firingCounts}
        />
      ))}
    </div>
  );
}

interface SectionProps {
  ds: TreeDataSource;
  filterText: string;
  activeKey?: string;
  focusKey?: string;
  onSelect: (dataSourceUid: string, folderKey: string) => void;
  firingCounts: Map<string, number>;
}

function DataSourceSection({ ds, filterText, activeKey, focusKey, onSelect, firingCounts }: SectionProps) {
  const styles = useStyles2(getStyles);
  const folders = ds.folders.filter((f) => matchesFilter(f.title, filterText));

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{ds.name}</span>
        {ds.error && (
          <span className={styles.errorTag}>
            <Trans i18nKey="alerting.rule-list-v2.ds-error-tag">Error</Trans>
          </span>
        )}
      </div>
      {ds.error && <div className={styles.errorRow}>{ds.error}</div>}
      {!ds.error &&
        folders.map((folder) => {
          const key = `${ds.uid}:${folder.key}`;
          const active = key === activeKey;
          const focused = key === focusKey;
          return (
            <FolderListRow
              key={folder.key}
              rowId={`folder-row-${key}`}
              title={folder.title}
              groupCount={folder.groups.length}
              firingCount={firingCounts.get(key) ?? 0}
              active={active}
              tabIndex={focused ? 0 : -1}
              onSelect={() => onSelect(ds.uid, folder.key)}
            />
          );
        })}
    </div>
  );
}

function matchesFilter(title: string, filterText: string): boolean {
  if (!filterText.trim()) {
    return true;
  }
  return title.toLowerCase().includes(filterText.toLowerCase());
}

function splitKey(key: string): [string, string] {
  const colon = key.indexOf(':');
  return [key.slice(0, colon), key.slice(colon + 1)];
}

function getStyles(theme: GrafanaTheme2) {
  return {
    tree: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    section: css({
      display: 'flex',
      flexDirection: 'column',
      marginBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0.5, 1),
      textTransform: 'uppercase',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.text.secondary,
      letterSpacing: '0.05em',
    }),
    sectionTitle: css({
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    errorTag: css({
      color: theme.colors.error.text,
      fontSize: theme.typography.bodySmall.fontSize,
      textTransform: 'none',
    }),
    errorRow: css({
      padding: theme.spacing(0.5, 1),
      color: theme.colors.error.text,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
