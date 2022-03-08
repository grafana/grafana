import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, IconName, Tag, useStyles2 } from '@grafana/ui';
import { uniqueId } from 'lodash';
import React from 'react';
import { RootStorageMeta } from './types';

interface Props {
  storage: RootStorageMeta[];
  title: string;
}

export function StorageList({ storage, title }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <>
      <h4 className={styles.secondaryTextColor}>{title}</h4>
      {storage.map((s) => {
        return (
          <Card key={uniqueId()}>
            <Card.Heading>{s.config.name}</Card.Heading>
            <Card.Meta>{s.config.prefix}</Card.Meta>
            <Card.Description>{getDescription(s)}</Card.Description>
            <Card.Figure>
              <Icon name={getIconName(s.config.type)} size="xxxl" className={styles.secondaryTextColor} />
            </Card.Figure>
            <Card.Tags>
              {s.ready ? <Tag colorIndex={5} name="Ready" /> : <Tag colorIndex={0} name="Not ready" />}
            </Card.Tags>
          </Card>
        );
      })}
    </>
  );
}
function getStyles(theme: GrafanaTheme2) {
  return {
    secondaryTextColor: css`
      color: ${theme.colors.text.secondary};
    `,
  };
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
export function getDescription(storage: RootStorageMeta) {
  if (storage.config.disk) {
    return `${storage.config.disk.path}`;
  }
  if (storage.config.git) {
    return `${storage.config.git.remote}`;
  }
  if (storage.config.sql) {
    return `${storage.config.sql}`;
  }
  return '';
}
