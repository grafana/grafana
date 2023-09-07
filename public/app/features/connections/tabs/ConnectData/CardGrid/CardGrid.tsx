import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';
import { Grid } from '@grafana/ui/src/unstable';
import { PluginAngularBadge } from 'app/features/plugins/admin/components/Badges';

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    fontSize: theme.typography.h5.fontSize,
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
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  card: css({
    gridTemplateAreas: `
        "Figure   Heading   Actions"
        "Figure Description Actions"
        "Figure    Meta     Actions"
        "Figure     -       Actions"`,
    marginBottom: '0px !important',
  }),
  logo: css({
    marginRight: theme.spacing(3),
    marginLeft: theme.spacing(1),
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

  const cardGridItemList = () => {
    const list: React.ReactElement[] = [];
    items.map((item) => {
      list.push(
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

          {item.angularDetected ? (
            <Card.Meta className={styles.meta}>
              <PluginAngularBadge />
            </Card.Meta>
          ) : null}
        </Card>
      );
    });
    return list;
  };

  return (
    <Grid display="grid" templateColumns="repeat(auto-fill, minmax(380px, 1fr))" gap={1.5}>
      {cardGridItemList()}
    </Grid>
  );
};
