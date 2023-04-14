import { css } from '@emotion/css';
import React, { MouseEvent, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import store from 'app/core/store';

import { TutorialCardType } from '../types';

import { cardContent, cardStyle, iconStyle } from './sharedStyles';

interface Props {
  card: TutorialCardType;
}

export const TutorialCard = ({ card }: Props) => {
  const styles = useStyles2(useCallback((theme: GrafanaTheme2) => getStyles(theme, card.done), [card.done]));
  const iconStyles = useStyles2(useCallback((theme: GrafanaTheme2) => iconStyle(theme, card.done), [card.done]));

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
        <Icon className={iconStyles} name={card.icon} size="xxl" />
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

const getStyles = (theme: GrafanaTheme2, complete: boolean) => {
  return {
    card: css`
      ${cardStyle(theme, complete)}
      width: 460px;
      min-width: 460px;

      ${theme.breakpoints.down('xl')} {
        min-width: 368px;
      }

      ${theme.breakpoints.down('lg')} {
        min-width: 272px;
      }
    `,
    type: css`
      color: ${theme.colors.primary.text};
      text-transform: uppercase;
    `,
    heading: css`
      text-transform: uppercase;
      color: ${theme.colors.primary.text};
      margin-bottom: ${theme.spacing(1)};
    `,
    cardTitle: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    info: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    status: css`
      display: flex;
      justify-content: flex-end;
    `,
  };
};
