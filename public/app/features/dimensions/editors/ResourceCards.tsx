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
  const styles = getStyles(theme);

  return (
    <div style={style}>
      {card && (
        <div key={card.value} className={styles.card} onClick={() => onChange(`${folder.value}/${card.value}`)}>
          {folder.value.includes('icons') ? (
            <SVG src={card.imgUrl} className={styles.img} />
          ) : (
            <img src={card.imgUrl} className={styles.img} />
          )}
          <h6 className={styles.text}>{card.label.substr(0, card.label.length - 4)}</h6>
        </div>
      )}
    </div>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    container: css`
      border: 1px solid rgba(204, 204, 220, 0.15);
    `,
    card: css`
      display: inline-block;
      width: 90px;
      height: 90px;
      margin: 0.75rem;
      margin-left: 15px;
      text-align: center;
      cursor: pointer;
      position: relative;
      background-color: transparent;
      border: 1px solid transparent;
      border-radius: 8px;
      padding-top: 6px;

      :hover {
        border-color: ${theme.colors.action.hover};
        box-shadow: ${theme.shadows.z2};
      }
    `,
    img: css`
      width: 40px;
      height: 40px;
      object-fit: cover;
      vertical-align: middle;
      fill: ${theme.colors.text.primary};
    `,
    text: css`
      color: ${theme.colors.text.primary};
      white-space: nowrap;
      font-size: 12px;
      text-overflow: ellipsis;
      display: block;
      overflow: hidden;
    `,
    grid: css`
      border: 1px solid rgba(204, 204, 220, 0.15);
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
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <AutoSizer defaultWidth={680}>
      {({ width, height }) => {
        const cardWidth = 90;
        const cardHeight = 90;
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
            className={styles.grid}
          >
            {memo(Cell, areEqual)}
          </Grid>
        );
      }}
    </AutoSizer>
  );
};
