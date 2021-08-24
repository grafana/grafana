import React, { memo, useState, ChangeEvent, CSSProperties } from 'react';
import { areEqual, FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GrafanaTheme2, SelectableValue } from '../../../../../../packages/grafana-data/src';
import { Input, useTheme2, stylesFactory, InlineFieldRow, InlineField } from '@grafana/ui';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
import { BaseDimensionConfig } from 'app/features/dimensions';

interface CellProps {
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
  data: any;
}
function Cell(props: CellProps) {
  const { columnIndex, rowIndex, style, data } = props;
  const { filteredCards: cards, columnCount, onSelectIcon, context } = data;
  const singleColumnIndex = columnIndex + rowIndex * columnCount;
  const card = cards[singleColumnIndex];
  const theme = useTheme2();
  const iconColor = context.options?.config?.fill?.fixed
    ? theme.visualization.getColorByName(context.options.config.fill.fixed)
    : theme.colors.text.primary;
  const styles = getStyles(theme, iconColor);

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
            margin: '.75rem',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative',
            backgroundColor: 'transparent',
          }}
        >
          <SVG src={card.imgUrl} onClick={() => onSelectIcon(card.value)} className={styles.card} />
          <h6 className={styles.text}>{card.label.substr(0, card.label.length - 4)}</h6>
        </div>
      )}
    </div>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme2, color) => {
  return {
    card: css`
      width: 50px;
      vertical-align: middle;
      fill: ${color};
    `,
    text: css`
      text-align: center;
      color: ${color};
      white-space: nowrap;
      font-size: 12px;
      text-overflow: ellipsis;
      display: block;
      max-width: 70px;
      overflow: hidden;
    `,
  };
});

function Search({
  onChangeSearch,
  value,
}: {
  onChangeSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  value: BaseDimensionConfig;
}) {
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Fixed">
          <Input defaultValue={value?.fixed} />
        </InlineField>
      </InlineFieldRow>
      <Input placeholder="Search" onChange={onChangeSearch} />
    </>
  );
}

interface CardProps {
  cards: SelectableValue[];
  onSelectIcon: (value: string) => void;
  context: any;
  value: BaseDimensionConfig;
}
const Cards = (props: CardProps) => {
  const { cards, onSelectIcon, context, value } = props;
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
      <Search onChangeSearch={onChangeSearch} value={value} />
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
                itemData={{ filteredCards, columnCount, onSelectIcon, context }}
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
