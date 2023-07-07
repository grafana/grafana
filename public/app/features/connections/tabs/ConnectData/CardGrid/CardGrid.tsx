import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';
import { PluginAngularBadge } from 'app/features/plugins/admin/components/Badges';

const getStyles = (theme: GrafanaTheme2) => ({
  sourcesList: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 12px;
    list-style: none;
    margin-bottom: 80px;
  `,
  heading: css({
    fontSize: theme.v1.typography.heading.h5,
    fontWeight: 'inherit',
  }),
  figure: css({
    width: 'inherit',
    marginRight: '0px',
    '> img': {
      width: theme.spacing(7),
    },
  }),
  meta: css({
    marginTop: '6px',
    position: 'relative',
  }),
  description: css({
    margin: '0px',
    fontSize: theme.typography.size.sm,
  }),
  card: css({
    gridTemplateAreas: `
        "Figure   Heading   Actions"
        "Figure Description Actions"
        "Figure    Meta     Actions"
        "Figure     -       Actions"`,
  }),
  logo: css({
    marginRight: theme.v1.spacing.lg,
    marginLeft: theme.v1.spacing.sm,
    width: theme.spacing(7),
    maxHeight: theme.spacing(7),
  }),
});

export type CardGridItem = {
  id: string;
  name: string;
  description: string;
  url: string;
  logo?: string;
  angularDetected?: boolean;
};
export interface CardGridProps {
  items: CardGridItem[];
  onClickItem?: (e: React.MouseEvent<HTMLElement>, item: CardGridItem) => void;
}

export const CardGrid = ({ items, onClickItem }: CardGridProps) => {
  const styles = useStyles2(getStyles);

  return (
    <ul className={styles.sourcesList}>
      {items.map((item) => (
        <Card
          key={item.id}
          className={styles.card}
          href={item.url}
          onClick={(e) => {
            if (onClickItem) {
              onClickItem(e, item);
            }
          }}
        >
          <Card.Heading className={styles.heading}>{item.name}</Card.Heading>

          <Card.Figure align="center" className={styles.figure}>
            <img className={styles.logo} src={item.logo} alt="" />
          </Card.Figure>

          {/* <Card.Description className={styles.description}>{item.description}</Card.Description> */}

          {/* Signature */}
          {item.angularDetected && (
            <Card.Meta className={styles.meta}>
              <PluginAngularBadge />
            </Card.Meta>
          )}
        </Card>
      ))}
    </ul>
  );
};
