import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import {
  Alert,
  Button,
  Card,
  FilterInput,
  HorizontalGroup,
  Icon,
  IconName,
  TagList,
  useStyles2,
  VerticalGroup,
  InlineField
} from '@grafana/ui';

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
    let show = storage.value ?? [];
    if (searchQuery?.length) {
      const lower = searchQuery.toLowerCase();
      show = show.filter((r) => {
        const v = r.config;
        const isMatch = v.name.toLowerCase().indexOf(lower) >= 0 || v.description.toLowerCase().indexOf(lower) >= 0;
        if (isMatch) {
          return true;
        }
        return false;
      });
    }

    const base: StorageInfo[] = [];
    const content: StorageInfo[] = [];
    for (const r of show ?? []) {
      if (r.config.underContentRoot) {
        content.push(r);
      } else if (r.config.prefix !== 'content') {
        base.push(r);
      }
    }
    return { base, content };
  }, [searchQuery, storage]);

  const renderRoots = (pfix: string, roots: StorageInfo[]) => {
    return (
      <VerticalGroup>
        {roots.map((s) => {
          const ok = s.ready;
          return (
            <Card key={s.config.prefix} href={ok ? `admin/storage/${pfix}${s.config.prefix}/` : undefined}>
              <Card.Heading>{s.config.name}</Card.Heading>
              <Card.Meta className={styles.clickable}>
                {s.config.description}
                {s.config.git?.remote && <a href={s.config.git?.remote}>{s.config.git?.remote}</a>}
              </Card.Meta>
              {s.notice?.map((notice) => (
                <Alert key={notice.text} severity={notice.severity} title={notice.text} />
              ))}

              <Card.Tags className={styles.clickable}>
                <HorizontalGroup>
                  <TagList tags={getTags(s)} />
                </HorizontalGroup>
              </Card.Tags>
              <Card.Figure className={styles.clickable}>
                <Icon name={getIconName(s.config.type)} size="xxxl" className={styles.secondaryTextColor} />
              </Card.Figure>
            </Card>
          );
        })}
      </VerticalGroup>
    );
  };

  return (
    <div>
      <div className="page-action-bar">
        <InlineField grow="true">
            <FilterInput placeholder="Search Storage" value={searchQuery} onChange={setSearchQuery} />
        </InlineField>
        <Button className="pull-right" onClick={() => onPathChange('', StorageView.AddRoot)}>
          Add Root
        </Button>
      </div>

      <div>{renderRoots('', roots.base)}</div>

      <div>
        <h3>Content</h3>
        {renderRoots('content/', roots.content)}
      </div>
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
