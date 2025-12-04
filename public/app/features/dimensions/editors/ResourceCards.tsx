import { css, cx } from '@emotion/css';
import { type KeyboardEvent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { type CellComponentProps, Grid } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';

import { ResourceItem } from './FolderPickerTab';

interface CellProps {
  cards: ResourceItem[];
  columnCount: number;
  onChange: (value: string) => void;
  selected?: string;
}

function Cell(props: CellComponentProps<CellProps>) {
  const { columnIndex, rowIndex, style, cards, columnCount, onChange, selected } = props;
  const singleColumnIndex = columnIndex + rowIndex * columnCount;
  const card = cards[singleColumnIndex];
  const styles = useStyles2(getStyles);

  return (
    <div style={style}>
      {card && (
        <div
          key={card.value}
          className={selected === card.value ? cx(styles.card, styles.selected) : styles.card}
          onClick={() => onChange(card.value)}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              onChange(card.value);
            }
          }}
          role="button"
          tabIndex={0}
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
}

interface CardProps {
  onChange: (value: string) => void;
  cards: ResourceItem[];
  value?: string;
}

export const ResourceCards = (props: CardProps) => {
  const { onChange, cards, value } = props;
  const styles = useStyles2(getStyles);

  return (
    <AutoSizer defaultWidth={680}>
      {({ width, height }) => {
        const cardWidth = 90;
        const cardHeight = 90;
        const columnCount = Math.floor(width / cardWidth);
        const rowCount = Math.ceil(cards.length / columnCount);
        return (
          <Grid
            style={{
              height,
              maxHeight: height,
              maxWidth: width,
              width,
            }}
            columnCount={columnCount}
            columnWidth={cardWidth}
            rowCount={rowCount}
            rowHeight={cardHeight}
            cellProps={{ cards, columnCount, onChange, selected: value }}
            className={styles.grid}
            cellComponent={Cell}
          />
        );
      }}
    </AutoSizer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'inline-block',
    width: '90px',
    height: '90px',
    margin: '0.75rem',
    marginLeft: '15px',
    textAlign: 'center',
    cursor: 'pointer',
    position: 'relative',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: theme.shape.radius.default,
    paddingTop: '6px',
    ':hover': {
      borderColor: theme.colors.action.hover,
      boxShadow: theme.shadows.z2,
    },
  }),
  selected: css({
    border: `2px solid ${theme.colors.primary.main}`,
    ':hover': {
      borderColor: theme.colors.primary.main,
    },
  }),
  img: css({
    width: '40px',
    height: '40px',
    objectFit: 'cover',
    verticalAlign: 'middle',
    fill: theme.colors.text.primary,
  }),
  text: css({
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
    fontSize: '12px',
    textOverflow: 'ellipsis',
    display: 'block',
    overflow: 'hidden',
  }),
  grid: css({
    border: `1px solid ${theme.colors.border.medium}`,
  }),
});
