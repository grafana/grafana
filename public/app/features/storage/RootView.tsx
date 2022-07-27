import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Card, FilterInput, Icon, IconName, TagList, useStyles2, VerticalGroup } from '@grafana/ui';

import { getGrafanaStorage } from './storage';
import { StorageInfo, StorageView } from './types';

interface Props {
  root: DataFrame;
  onPathChange: (p: string, v?: StorageView) => void;
}

export function RootView({ root, onPathChange }: Props) {
  const styles = useStyles2(getStyles);
  const storage = useAsync(getGrafanaStorage().getConfig);
  const [searchQuery, setSearchQuery] = useState<string>('');
  let base = location.pathname;
  if (!base.endsWith('/')) {
    base += '/';
  }

  const roots = useMemo(() => {
    const all = storage.value;
    if (searchQuery?.length && all) {
      const lower = searchQuery.toLowerCase();
      return all.filter((r) => {
        const v = r.config;
        const isMatch = v.name.toLowerCase().indexOf(lower) >= 0 || v.description.toLowerCase().indexOf(lower) >= 0;
        if (isMatch) {
          return true;
        }
        return false;
      });
    }
    return all ?? [];
  }, [searchQuery, storage]);

  return (
    <div>
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow">
          <FilterInput placeholder="Search Storage" value={searchQuery} onChange={setSearchQuery} />
        </div>
        <Button className="pull-right" onClick={() => onPathChange('', StorageView.AddRoot)}>
          Add Root
        </Button>
        {config.featureToggles.export && (
          <Button className="pull-right" onClick={() => onPathChange('', StorageView.Export)}>
            Export
          </Button>
        )}
      </div>
      <VerticalGroup>
        {roots.map((s) => (
          <Card key={s.config.prefix} href={`admin/storage/${s.config.prefix}/`}>
            <Card.Heading>{s.config.name}</Card.Heading>
            <Card.Meta className={styles.clickable}>{s.config.description}</Card.Meta>
            <Card.Tags className={styles.clickable}>
              <TagList tags={getTags(s)} />
            </Card.Tags>
            <Card.Figure className={styles.clickable}>
              <Icon name={getIconName(s.config.type)} size="xxxl" className={styles.secondaryTextColor} />
            </Card.Figure>
          </Card>
        ))}
      </VerticalGroup>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    secondaryTextColor: css`
      color: ${theme.colors.text.secondary};
    `,
    clickable: css`
      pointer-events: none;
    `,
  };
}

function getTags(v: StorageInfo) {
  const tags: string[] = [];
  if (v.builtin) {
    tags.push('Builtin');
  }
  if (!v.editable) {
    tags.push('Read only');
  }

  // Error
  if (!v.ready) {
    tags.push('Not ready');
  }
  return tags;
}

export function getIconName(type: string): IconName {
  switch (type) {
    case 'git':
      return 'code-branch';
    case 'disk':
      return 'folder-open';
    case 'sql':
      return 'database';
    default:
      return 'folder-open';
  }
}
