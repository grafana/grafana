import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Button, Card, Icon, IconName, useStyles2 } from '@grafana/ui';
import { uniqueId } from 'lodash';
import React, { useCallback, useState } from 'react';
import { RootStorageMeta } from './types';

interface Props {
  storage: RootStorageMeta[];
  title: string;
  type: 'dash' | 'res';
}

export function StorageList({ storage, title, type }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <>
      <h4 className={styles.secondaryTextColor}>{title}</h4>
      {storage.map((s) => {
        return (
          <Card key={uniqueId()} href={`/org/storage/${type}/${s.config.prefix}?path=${s.config.prefix}`}>
            <Card.Heading>
              {s.config.name}
              <Badge
                className={styles.badge}
                text={s.ready ? 'Ready' : 'Not ready'}
                color={s.ready ? 'green' : 'red'}
              />
            </Card.Heading>
            <Card.Meta>{s.config.prefix}</Card.Meta>
            <Card.Description>{getDescription(s)}</Card.Description>
            {s.config.git && (
              <Card.Tags>
                <PullButton storage={s} />
              </Card.Tags>
            )}
            <Card.Figure>
              <Icon name={getIconName(s.config.type)} size="xxxl" className={styles.secondaryTextColor} />
            </Card.Figure>
          </Card>
        );
      })}
    </>
  );
}
interface Props2 {
  storage: RootStorageMeta;
}

function PullButton({ storage }: Props2) {
  const [pulling, setPulling] = useState(false);
  const onClick = useCallback(() => {
    console.log('HERE', storage);
    setPulling(true);
  }, [storage]);

  return (
    <>
      <Button key="settings" variant="secondary" icon={pulling ? 'fa fa-spinner' : undefined} onClick={onClick}>
        Pull
      </Button>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    secondaryTextColor: css`
      color: ${theme.colors.text.secondary};
    `,
    badge: css`
      margin-left: ${theme.spacing(1)};
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
