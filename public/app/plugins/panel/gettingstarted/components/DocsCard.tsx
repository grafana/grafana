import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { Card } from '../types';

import { cardContent, cardStyle, iconStyle } from './sharedStyles';

interface Props {
  card: Card;
}

export const DocsCard: FC<Props> = ({ card }) => {
  const styles = useStyles2((theme) => getStyles(theme, card.done));
  const iconStyles = useStyles2((theme) => iconStyle(theme, card.done));

  return (
    <div className={styles.card}>
      <div className={cardContent}>
        <a href={`${card.href}?utm_source=grafana_gettingstarted`} className={styles.url}>
          <div className={styles.heading}>{card.done ? 'complete' : card.heading}</div>
          <h4 className={styles.title}>{card.title}</h4>
          <div>
            <Icon className={iconStyles} name={card.icon} size="xxl" />
          </div>
        </a>
      </div>
      <a
        href={`${card.learnHref}?utm_source=grafana_gettingstarted`}
        className={styles.learnUrl}
        target="_blank"
        rel="noreferrer"
      >
        Learn how in the docs <Icon name="external-link-alt" />
      </a>
    </div>
  );
};

const getStyles = (newTheme: GrafanaTheme2, complete: boolean) => {
  const theme = newTheme;

  return {
    card: css`
      ${cardStyle(newTheme, complete)}

      min-width: 230px;

      ${theme.breakpoints.down('md')} {
        min-width: 192px;
      }
    `,
    heading: css`
      text-transform: uppercase;
      color: ${complete ? theme.v1.palette.blue95 : '#FFB357'};
      margin-bottom: ${theme.spacing(2)};
    `,
    title: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    url: css`
      display: inline-block;
    `,
    learnUrl: css`
      border-top: 1px solid ${theme.colors.border.weak};
      position: absolute;
      bottom: 0;
      padding: 8px 16px;
      width: 100%;
    `,
  };
};
