import React, { FC } from 'react';
import { Card } from '../types';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { cardContent, cardStyle, iconStyle } from './sharedStyles';

interface Props {
  card: Card;
}

export const DocsCard: FC<Props> = ({ card }) => {
  const theme = useTheme();
  const styles = getStyles(theme, card.done);

  return (
    <div className={styles.card}>
      <div className={cardContent}>
        <a href={`${card.href}?utm_source=grafana_gettingstarted`}>
          <div className={styles.heading}>{card.done ? 'complete' : card.heading}</div>
          <h4 className={styles.title}>{card.title}</h4>
          <div>
            <Icon className={iconStyle(theme, card.done)} name={card.icon} size="xxl" />
          </div>
        </a>
      </div>
      <a href={`${card.learnHref}?utm_source=grafana_gettingstarted`} className={styles.url} target="_blank">
        Learn how in the docs <Icon name="external-link-alt" />
      </a>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, complete: boolean) => {
  return {
    card: css`
      ${cardStyle(theme, complete)}

      min-width: 230px;

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        min-width: 192px;
      }
    `,
    heading: css`
      text-transform: uppercase;
      color: ${complete ? theme.palette.blue95 : '#FFB357'};
      margin-bottom: ${theme.spacing.md};
    `,
    title: css`
      margin-bottom: 48px;
    `,
    url: css`
      border-top: 1px solid ${theme.colors.border1};
      position: absolute;
      bottom: 0;
      padding: 8px 16px;
      width: 100%;
    `,
  };
});
