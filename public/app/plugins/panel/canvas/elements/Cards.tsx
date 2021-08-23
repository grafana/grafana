import React, { memo, useState, ChangeEvent, CSSProperties } from 'react';
import { areEqual, FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { SelectableValue } from '../../../../../../packages/grafana-data/src';
import { Input } from '@grafana/ui';

interface CellProps {
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
  data: any;
}
function Cell(props: CellProps) {
  const { columnIndex, rowIndex, style, data } = props;
  const { filteredCards: cards, columnCount, onSelectIcon } = data;
  const singleColumnIndex = columnIndex + rowIndex * columnCount;
  const card = cards[singleColumnIndex];

  return (
    <div style={style}>
      {card && (
        <div
          key={card.value}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100px',
            height: '100px',
            flexDirection: 'column',
            background: '#f5f6fa',
            margin: '.75rem',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <img
            alt={card.label}
            src={card.imgUrl}
            onClick={() => onSelectIcon(card.value)}
            style={{
              width: '50px',
              verticalAlign: 'middle',
            }}
          />
          <h6
            style={{
              textAlign: 'center',
              color: '#000000',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              fontSize: '12px',
              textOverflow: 'ellipsis',
              display: 'block',
              maxWidth: '70px',
            }}
          >
            {card.label.substr(0, card.label.length - 4)}
          </h6>
        </div>
      )}
    </div>
  );
}

function Search({ onChangeSearch }: { onChangeSearch: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return <Input placeholder="Search" onChange={onChangeSearch} />;
}

interface CardProps {
  cards: SelectableValue[];
  onSelectIcon: (value: string) => void;
}
const Cards = (props: CardProps) => {
  const { cards, onSelectIcon } = props;
  const [filteredCards, setFilteredCards] = useState<SelectableValue[]>(cards);
  const onChangeSearch = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      // exclude .svg ending in the search
      const filtered = cards.filter((card) => card.value.substr(0, card.value.length - 4).includes(e.target.value));
      setFilteredCards(filtered);
    } else {
      setFilteredCards(cards);
    }
  };
  return (
    <>
      <Search onChangeSearch={onChangeSearch} />
      <div
        style={{
          minHeight: '100vh',
          marginTop: '2em',
          position: 'sticky',
          top: '0px',
        }}
      >
        <AutoSizer defaultWidth={1920} defaultHeight={1080}>
          {({ width, height }) => {
            const cardWidth = 80;
            const cardHeight = 80;
            const columnCount = Math.floor(width / cardWidth);
            const rowCount = Math.ceil(cards.length / columnCount);
            return (
              <Grid
                width={width}
                height={height}
                columnCount={columnCount}
                columnWidth={cardWidth}
                rowCount={rowCount}
                rowHeight={cardHeight}
                itemData={{ filteredCards, columnCount, onSelectIcon }}
              >
                {memo(Cell, areEqual)}
              </Grid>
            );
          }}
        </AutoSizer>
      </div>
    </>
  );
};

export default Cards;
