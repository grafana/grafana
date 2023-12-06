import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { addTutorial, startTutorial } from 'app/features/tutorial/slice';
import { useDispatch } from 'app/types';

import { InAppTutorialCardType } from '../types';

import { cardContent, cardStyle, iconStyle } from './sharedStyles';

interface Props {
  card: InAppTutorialCardType;
}

export const InAppTutorialCard = ({ card }: Props) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles, card.done);
  const iconStyles = useStyles2(iconStyle, card.done);

  return (
    <button
      className={styles.card}
      onClick={() => {
        dispatch(addTutorial(card.tutorial));
        dispatch(startTutorial(card.tutorial.id));
      }}
    >
      <div className={cardContent}>
        <div className={styles.heading}>{card.done ? 'complete' : card.heading}</div>
        <h4 className={styles.cardTitle}>{card.title}</h4>
        <div className={styles.info}>{card.info}</div>
        <Icon className={iconStyles} name={card.icon} size="xxl" />
      </div>
    </button>
  );
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
