import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, DataFrameView, GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, IconName, TagList, useStyles2, VerticalGroup } from '@grafana/ui';

interface Props {
  root: DataFrame;
}

interface RootFolder {
  name: string;
  title: string;
  storageType: string;
  description: string;
  readOnly: boolean;
  builtIn: boolean;
}

export function StorageRoot({ root }: Props) {
  const styles = useStyles2(getStyles);
  const view = new DataFrameView<RootFolder>(root);
  let base = location.pathname;
  if (!base.endsWith('/')) {
    base += '/';
  }

  return (
    <VerticalGroup>
      {view.map((v) => (
        <Card key={v.name} href={base + v.name}>
          <Card.Heading>{v.title ?? v.name}</Card.Heading>
          <Card.Meta>{v.description}</Card.Meta>
          <Card.Tags>
            <TagList tags={getTags(v)} />
          </Card.Tags>
          <Card.Figure>
            <Icon name={getIconName(v.storageType)} size="xxxl" className={styles.secondaryTextColor} />
          </Card.Figure>
        </Card>
      ))}
    </VerticalGroup>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    secondaryTextColor: css`
      color: ${theme.colors.text.secondary};
    `,
  };
}

function getTags(v: RootFolder) {
  const tags: string[] = [];
  if (v.builtIn) {
    tags.push('Builtin');
  }
  if (v.readOnly) {
    tags.push('Read only');
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
