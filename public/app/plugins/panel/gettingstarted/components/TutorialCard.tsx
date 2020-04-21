import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '@grafana/ui';
import { css } from 'emotion';
import { Card } from '../types';
import { cardContent, cardStyle } from './sharedStyles';
import { Grafana } from '@grafana/ui/src/components/Icon/assets';

interface Props {
  card: Card;
}

export const TutorialCard: FC<Props> = ({ card }) => {
  const theme = useTheme();
  const styles = getStyles(theme, card.done);

  return (
    <div className={styles.card}>
      <div className={cardContent}>
        <div className={styles.heading}>{card.done ? 'complete' : card.heading}</div>
        <h4>{card.title}</h4>
        <div className={styles.info}>{card.info}</div>
        <Grafana size={40} />
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, complete: boolean) => {
  return {
    card: css`
      ${cardStyle(theme, complete)}
      width: 460px;
    `,
    heading: css`
      text-transform: uppercase;
      color: ${complete ? '#245BAF' : '#FFB357'};
      margin-bottom: 16px;
    `,
    info: css`
      margin-bottom: 40px;
    `,
    status: css`
      display: flex;
      justify-content: flex-end;
    `,
  };
});
