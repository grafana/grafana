import { css } from '@emotion/css';
import React, { FC, MouseEvent } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import store from 'app/core/store';

import { TutorialCardType } from '../types';

import { cardContent, cardStyle, iconStyle } from './sharedStyles';

interface Props {
  card: TutorialCardType;
}

export const TutorialCard: FC<Props> = ({ card }) => {
  const theme = useTheme();
  const styles = getStyles(theme, card.done);

  return (
    <a
      className={styles.card}
      target="_blank"
      rel="noreferrer"
      href={`${card.href}?utm_source=grafana_gettingstarted`}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => handleTutorialClick(event, card)}
    >
      <div className={cardContent}>
        <div className={styles.type}>{card.type}</div>
        <div className={styles.heading}>{card.done ? 'complete' : card.heading}</div>
        <h4 className={styles.cardTitle}>{card.title}</h4>
        <div className={styles.info}>{card.info}</div>
        <Icon className={iconStyle(theme, card.done)} name={card.icon} size="xxl" />
      </div>
    </a>
  );
};

const handleTutorialClick = (event: MouseEvent<HTMLAnchorElement>, card: TutorialCardType) => {
  event.preventDefault();
  const isSet = store.get(card.key);
  if (!isSet) {
    store.set(card.key, true);
  }
};

const getStyles = stylesFactory((theme: GrafanaTheme, complete: boolean) => {
  return {
    card: css`
      ${cardStyle(theme, complete)}
      width: 460px;
      min-width: 460px;

      @media only screen and (max-width: ${theme.breakpoints.xl}) {
        min-width: 368px;
      }

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        min-width: 272px;
      }
    `,
    type: css`
      color: ${theme.colors.textBlue};
      text-transform: uppercase;
    `,
    heading: css`
      text-transform: uppercase;
      color: ${theme.colors.textBlue};
      margin-bottom: ${theme.spacing.sm};
    `,
    cardTitle: css`
      margin-bottom: ${theme.spacing.md};
    `,
    info: css`
      margin-bottom: ${theme.spacing.md};
    `,
    status: css`
      display: flex;
      justify-content: flex-end;
    `,
  };
});
