import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { Card, SetupStep, TutorialCardType } from '../types';

import { DocsCard } from './DocsCard';
import { TutorialCard } from './TutorialCard';

interface Props {
  step: SetupStep;
}

export const Step: FC<Props> = ({ step }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.setup}>
      <div className={styles.info}>
        <h2 className={styles.title}>{step.title}</h2>
        <p>{step.info}</p>
      </div>
      <div className={styles.cards}>
        {step.cards.map((card: Card | TutorialCardType, index: number) => {
          const key = `${card.title}-${index}`;
          if (card.type === 'tutorial') {
            return <TutorialCard key={key} card={card as TutorialCardType} />;
          }
          return <DocsCard key={key} card={card} />;
        })}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    setup: css`
      display: flex;
      width: 95%;
    `,
    info: css`
      width: 172px;
      margin-right: 5%;

      ${theme.breakpoints.down('xxl')} {
        margin-right: ${theme.spacing(4)};
      }
      ${theme.breakpoints.down('sm')} {
        display: none;
      }
    `,
    title: css`
      color: ${theme.v1.palette.blue95};
    `,
    cards: css`
      overflow-x: scroll;
      overflow-y: hidden;
      width: 100%;
      display: flex;
      justify-content: center;

      ${theme.breakpoints.down('xxl')} {
        justify-content: flex-start;
      }
    `,
  };
};
