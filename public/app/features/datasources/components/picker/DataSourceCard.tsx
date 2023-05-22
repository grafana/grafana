import { css, cx } from '@emotion/css';
import React from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Card, TagList, useStyles2 } from '@grafana/ui';

interface DataSourceCardProps {
  ds: DataSourceInstanceSettings;
  onClick: () => void;
  selected: boolean;
  description?: string;
}

export function DataSourceCard({ ds, onClick, selected, description, ...htmlProps }: DataSourceCardProps) {
  const styles = useStyles2(getStyles);

  return (
    <Card
      key={ds.uid}
      onClick={onClick}
      className={cx(styles.card, selected ? styles.selected : undefined)}
      {...htmlProps}
    >
      <Card.Heading className={styles.heading}>
        <div className={styles.headingContent}>
          <span className={styles.name}>
            {ds.name} {ds.isDefault ? <TagList tags={['default']} /> : null}
          </span>
          <small className={styles.type}>{description || ds.meta.name}</small>
        </div>
      </Card.Heading>
      <Card.Figure className={styles.logo}>
        <img src={ds.meta.info.logos.small} alt={`${ds.meta.name} Logo`} />
      </Card.Figure>
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
    heading: css`
      width: 100%;
      overflow: hidden;
      // This is needed to enable ellipsis when text overlfows
      > button {
        width: 100%;
      }
    `,
    headingContent: css`
      color: ${theme.colors.text.secondary};
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      justify-content: space-between;
    `,
    logo: css`
      width: 32px;
      height: 32px;
      padding: ${theme.spacing(0, 1)};
      display: flex;
      align-items: center;

      > img {
        max-height: 100%;
        min-width: 24px;
      }
    `,
    name: css`
      color: ${theme.colors.text.primary};
      display: flex;
      gap: ${theme.spacing(2)};
    `,
    type: css`
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      align-items: center;
    `,
    separator: css`
      margin: 0 ${theme.spacing(1)};
      color: ${theme.colors.border.weak};
    `,
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
    `,
  };
}
