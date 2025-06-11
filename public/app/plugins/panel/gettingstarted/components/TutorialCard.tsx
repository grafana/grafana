import { css } from '@emotion/css';
import { MouseEvent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
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
        <div className={styles.heading}>
          {card.done ? t('gettingstarted.tutorial-card.complete', 'complete') : card.heading}
        </div>
        <h4 className={styles.cardTitle}>{card.title}</h4>
        <div className={styles.info}>{card.info}</div>
      </div>
    </a>
  );
};

const handleTutorialClick = (event: MouseEvent<HTMLAnchorElement>, card: TutorialCardType) => {
  const isSet = store.get(card.key);
  if (!isSet) {
    store.set(card.key, true);
  }
  reportInteraction('grafana_getting_started_tutorial', { title: card.title });
};

const getStyles = (theme: GrafanaTheme2, complete: boolean) => {
  return {
    card: css({
      ...cardStyle(theme, complete),
      width: '460px',
      minWidth: '460px',

      [theme.breakpoints.down('xl')]: {
        minWidth: '368px',
      },

      [theme.breakpoints.down('lg')]: {
        minWidth: '272px',
      },
    }),
    type: css({
      color: theme.colors.primary.text,
      textTransform: 'uppercase',
    }),
    heading: css({
      textTransform: 'uppercase',
      color: theme.colors.primary.text,
      marginBottom: theme.spacing(1),
    }),
    cardTitle: css({
      marginBottom: theme.spacing(2),
    }),
    info: css({
      marginBottom: theme.spacing(2),
    }),
    status: css({
      display: 'flex',
      justifyContent: 'flex-end',
    }),
  };
};
