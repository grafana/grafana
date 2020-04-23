import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import { css } from 'emotion';
import { Card } from '../types';
import { cardContent, cardStyle, iconStyle } from './sharedStyles';

interface Props {
  card: Card;
}

export const TutorialCard: FC<Props> = ({ card }) => {
  const theme = useTheme();
  const styles = getStyles(theme, card.done);

  return (
    <a href={card.href} className={styles.card} target="_blank">
      <div className={cardContent}>
        <div className={styles.type}>{card.type}</div>
        <div className={styles.heading}>{card.done ? 'complete' : card.heading}</div>
        <h4>{card.title}</h4>
        <div className={styles.info}>{card.info}</div>
        <Icon className={iconStyle(theme, card.done)} name={card.icon} size="xxl" />
      </div>
    </a>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, complete: boolean) => {
  const textColor = `${complete ? '#245BAF' : '#FFB357'}`;
  return {
    card: css`
      ${cardStyle(theme, complete)}
      width: 460px;
    `,
    type: css`
      color: ${textColor};
      text-transform: uppercase;
    `,
    heading: css`
      text-transform: uppercase;
      color: ${textColor};
      margin-bottom: 8px;
    `,
    info: css`
      margin-bottom: 16px;
    `,
    status: css`
      display: flex;
      justify-content: flex-end;
    `,
  };
});
