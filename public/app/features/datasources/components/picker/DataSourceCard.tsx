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
    <Card key={ds.uid} onClick={onClick} className={cx(styles.card, { [styles.selected]: selected })}>
      <Card.Heading>{ds.name}</Card.Heading>
      <Card.Meta>
        {ds.meta.name}
        {ds.meta.info.description}
      </Card.Meta>
      <Card.Figure>
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
    `,
    selected: css`
      background-color: ${theme.colors.background.secondary};
    `,
  };
}
