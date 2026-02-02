import { css } from '@emotion/css';
import React, { FC } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { config } from '@grafana/runtime';
import { stylesFactory } from '@grafana/ui';
import { StoreState } from 'app/types';

import { getCards } from './cards';
import { HelpCard } from './components/HelpCard';
import { Card, Options } from './types';

const connector = connect((state: StoreState) => {
  return { configurableLinks: state.dashboard.configurableLinks };
}, {});

interface OwnProps {
  options: Options;
}

type HelpCardsProps = ConnectedProps<typeof connector> & OwnProps;

const HelpCardsUnconnected: FC<HelpCardsProps> = ({ options, configurableLinks }) => {
  // BMC code - begin
  const [cards, setCards] = React.useState<Card[]>([]);

  React.useEffect(() => {
    if (configurableLinks) {
      setCards(getCards({ ...configurableLinks, descr: options.descr }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configurableLinks]);

  React.useEffect(() => {
    const newCards = cards.map((card: Card) => {
      return {
        ...card,
        info: options.descr[card.id],
      };
    });
    if (newCards.length) {
      setCards(newCards);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.descr]);
  // BMC code - end

  const styles = getStyles();
  return (
    <div className={styles.cards}>
      {[...new Array(cards.length * 2 - (cards.length ? 1 : 0))].map((_, index: number) => {
        if (index % 2 === 0) {
          const card = cards[index / 2];
          const key = `${card.type}-${index}`;
          const containerKey = 'container' + key;
          return (
            <div key={containerKey} className={styles.cardContainer}>
              <HelpCard key={key} card={card} />
            </div>
          );
        } else {
          const dividerKey = 'divider' + `-${index}`;
          return <div key={dividerKey} className={styles.divider}></div>;
        }
      })}
    </div>
  );
};

export const HelpCards = connector(HelpCardsUnconnected);

const getStyles = stylesFactory(() => {
  const { theme } = config;

  return {
    cards: css`
      display: flex;
      align-items: flex-start;
      justify-content: center;

      @media only screen and (max-width: ${theme.breakpoints.xxl}) {
        justify-content: flex-start;
        width: 100%;
      }
    `,
    cardContainer: css`
      display: flex;
      align-items: center;
      text-align: center;
      width: 100%;
    `,
    divider: css`
      margin: 0 ${theme.spacing.sm};
      height: 69px;
      border-left-style: solid;
      border-left-width: 2px;
      border-left-color: ${theme.palette.gray95};
      margin-top: 40px;
      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        height: 32px;
      }
    `,
  };
});
