import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';
import { CatalogPlugin } from 'app/features/plugins/admin/types';

const getStyles = (theme: GrafanaTheme2) => ({
  sourcesList: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    list-style: none;
  `,
  card: css`
    height: 90px;
    padding: 0px 24px;
    box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.6);
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

export const CardGrid: FC<{ plugins: CatalogPlugin[] }> = ({ plugins }) => {
  const styles = useStyles2(getStyles);

  return (
    <ul className={styles.sourcesList}>
      {plugins.map((plugin) => (
        <Card key={plugin.id} className={styles.card} href={`plugins/${plugin.id}`}>
          <Card.Heading>
            <div className={styles.cardContent}>
              {plugin.info.logos.small && (
                <div className={styles.logoWrapper}>
                  <img src={plugin.info.logos.small} alt={`logo of ${plugin.name}`} />
                </div>
              )}
              <h4 className={styles.label}>{plugin.name}</h4>
            </div>
          </Card.Heading>
        </Card>
      ))}
    </ul>
  );
};
