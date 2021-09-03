import React, { memo, CSSProperties } from 'react';
import { areEqual, FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { useTheme2, stylesFactory } from '@grafana/ui';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';

interface CellProps {
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
  data: any;
}

function Cell(props: CellProps) {
  const { columnIndex, rowIndex, style, data } = props;
  const { cards, columnCount, onChange, folder } = data;
  const singleColumnIndex = columnIndex + rowIndex * columnCount;
  const card = cards[singleColumnIndex];
  const theme = useTheme2();
  const styles = getStyles(theme, theme.colors.text.primary);

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
          {folder.value.includes('icons') ? (
            <SVG src={card.imgUrl} onClick={() => onChange(`${folder.value}/${card.value}`)} className={styles.card} />
          ) : (
            <img src={card.imgUrl} onClick={() => onChange(`${folder.value}/${card.value}`)} className={styles.card} />
          )}
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

interface CardProps {
  onChange: (value: string) => void;
  cards: SelectableValue[];
  currentFolder: SelectableValue<string> | undefined;
}

export const ResourceCards = (props: CardProps) => {
  const { onChange, cards, currentFolder: folder } = props;

  return (
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
            itemData={{ cards, columnCount, onChange, folder }}
          >
            {memo(Cell, areEqual)}
          </Grid>
        );
      }}
    </AutoSizer>
  );
};
