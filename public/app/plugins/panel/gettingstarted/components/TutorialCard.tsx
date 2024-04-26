import { css } from '@emotion/css';
import React, { MouseEvent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import store from 'app/core/store';

import { TutorialCardType } from '../types';

import { cardContent, cardStyle } from './sharedStyles';

interface Props {
  card: TutorialCardType;
}

export const TutorialCard = ({ card }: Props) => {
  const styles = useStyles2(getStyles, card.done);

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
  reportInteraction('grafana_getting_started_tutorial', { title: card.title });
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
