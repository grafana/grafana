import { css, cx } from '@emotion/css';
import React, { memo, CSSProperties } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { areEqual, FixedSizeGrid as Grid } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2, stylesFactory } from '@grafana/ui';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';

import { ResourceItem } from './FolderPickerTab';

interface CellProps {
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
  data: {
    cards: ResourceItem[];
    columnCount: number;
    onChange: (value: string) => void;
    selected?: string;
  };
}

const MemoizedCell = memo(function Cell(props: CellProps) {
  const { columnIndex, rowIndex, style, data } = props;
  const { cards, columnCount, onChange, selected } = data;
  const singleColumnIndex = columnIndex + rowIndex * columnCount;
  const card = cards[singleColumnIndex];
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div style={style}>
      {card && (
        // TODO: fix keyboard a11y
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          key={card.value}
          className={selected === card.value ? cx(styles.card, styles.selected) : styles.card}
          onClick={() => onChange(card.value)}
        >
          {card.imgUrl.endsWith('.svg') ? (
            <SanitizedSVG src={card.imgUrl} className={styles.img} />
          ) : (
            <img src={card.imgUrl} alt="" className={styles.img} />
          )}
          <h6 className={styles.text}>{card.label.slice(0, -4)}</h6>
        </div>
      )}
    </div>
  );
}, areEqual);

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
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
    selected: css`
      border: 2px solid ${theme.colors.primary.main};
      :hover {
        border-color: ${theme.colors.primary.main};
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
      border: 1px solid ${theme.colors.border.medium};
    `,
  };
});

interface CardProps {
  onChange: (value: string) => void;
  cards: ResourceItem[];
  value?: string;
}

export const ResourceCards = (props: CardProps) => {
  const { onChange, cards, value } = props;
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
            itemData={{ cards, columnCount, onChange, selected: value }}
            className={styles.grid}
          >
            {MemoizedCell}
          </Grid>
        );
      }}
    </AutoSizer>
  );
};
