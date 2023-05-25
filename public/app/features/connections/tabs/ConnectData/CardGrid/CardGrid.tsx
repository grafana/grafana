import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  sourcesList: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    list-style: none;
    margin-bottom: 80px;
  `,
  card: css`
    height: 90px;
    padding: 0px 24px;
    margin-bottom: 0;
  `,
  cardContent: css`
    display: flex;
    align-items: center;
  `,
  logoWrapper: css`
    display: flex;
    justify-content: center;
    margin-right: 8px;
    width: 32px;
    height: 32px;
    img {
      max-width: 100%;
      max-height: 100%;
      align-self: center;
    }
  `,
  label: css`
    color: ${theme.colors.text.primary};
    margin-bottom: 0;
  `,
});

export type CardGridItem = { id: string; name: string; description: string; url: string; logo?: string };
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
          <Card.Heading>
            <div className={styles.cardContent}>
              {item.logo && (
                <div className={styles.logoWrapper}>
                  <img src={item.logo} alt={`logo of ${item.name}`} />
                </div>
              )}
              <h4 className={styles.label}>{item.name}</h4>
            </div>
          </Card.Heading>
        </Card>
      ))}
    </ul>
  );
};
