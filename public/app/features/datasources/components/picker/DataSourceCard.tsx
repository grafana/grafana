import { css, cx } from '@emotion/css';
import React from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Card, TagList, useStyles2 } from '@grafana/ui';

interface DataSourceCardProps {
  ds: DataSourceInstanceSettings;
  onClick: () => void;
  selected: boolean;
}

export function DataSourceCard({ ds, onClick, selected }: DataSourceCardProps) {
  const styles = useStyles2(getStyles);

  return (
    <Card
      key={ds.uid}
      onClick={onClick}
      className={cx(styles.card, selected ? styles.selected : undefined)}
      title={ds.meta.info.description}
    >
      <Card.Heading>{ds.name}</Card.Heading>
      <Card.Figure className={styles.img}>
        <img src={ds.meta.info.logos.small} alt={`${ds.meta.name} Logo`} height="40" width="40" />
      </Card.Figure>
      <Card.Tags>{ds.isDefault ? <TagList tags={['default']} /> : null}</Card.Tags>
    </Card>
  );
}

// Get styles for the component
function getStyles(theme: GrafanaTheme2) {
  return {
    card: css`
      cursor: pointer;
      background-color: ${theme.colors.background.primary};
      border-bottom: 1px solid ${theme.colors.border.weak};
      // Move to list component
      margin-bottom: 0;
      border-radius: 0;
      padding: ${theme.spacing(1)};
    `,
    img: css({
      marginLeft: theme.spacing(1),
      '> img': {
        width: theme.spacing(3),
        height: 'auto',
      },
    }),
    selected: css`
      background-color: ${theme.colors.background.secondary};
    `,
    meta: css`
      display: block;
      overflow-wrap: unset;
      white-space: nowrap;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: none;
    `,
  };
}
