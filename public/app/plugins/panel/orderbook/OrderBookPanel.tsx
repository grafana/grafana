import { css, cx } from '@emotion/css';
import { useLayoutEffect, useMemo, useRef } from 'react';

import { colorManipulator, type GrafanaTheme2, type PanelProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { BarAlign, type Options } from './types';
import { type OrderBookLevel, prepareOrderBook, type SizeSnapshot, snapshotSizes } from './utils';

type Props = PanelProps<Options>;

export function OrderBookPanel({ data, options, width, height }: Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  // Keep the previous sizes between renders so each level can show how much it changed.
  const prevSizes = useRef<SizeSnapshot>({ bid: new Map(), ask: new Map() });

  // Used to scroll the mid price to the vertical center on first display, while leaving the book
  // freely scrollable afterwards.
  const scrollRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const hasCentered = useRef(false);

  const askColor = theme.visualization.getColorByName(options.askColor);
  const bidColor = theme.visualization.getColorByName(options.bidColor);

  const book = useMemo(
    () => prepareOrderBook(data.series, options, theme, prevSizes.current),
    [data.series, options, theme]
  );

  // Snapshot the sizes so the next data update has a baseline to diff against for the delta column.
  prevSizes.current = snapshotSizes(book);

  // Center the mid price the first time the book renders with data. We intentionally do this only once
  // so the user can scroll freely afterwards (and live updates don't yank the scroll position back).
  useLayoutEffect(() => {
    if (hasCentered.current) {
      return;
    }
    const scroller = scrollRef.current;
    const mid = midRef.current;
    if (scroller && mid) {
      scroller.scrollTop = mid.offsetTop + mid.offsetHeight / 2 - scroller.clientHeight / 2;
      hasCentered.current = true;
    }
  });

  if (!book || (book.asks.length === 0 && book.bids.length === 0)) {
    return (
      <div className={styles.empty} style={{ width, height }}>
        {t('orderbook.no-data', 'No order book data. Provide price and size fields (and optionally a side field).')}
      </div>
    );
  }

  const scale = (value: number, max: number) => (max > 0 ? Math.min(100, (value / max) * 100) : 0);

  // Shared, fixed-width grid so the header labels line up with the values in every row. The font is
  // monospace, so `ch` units track digit width precisely. The first (price) column flexes. When the
  // book is crossed the size column holds two values ("buy / sell"), so it gets extra width.
  const numCol = '7ch';
  const sizeCol = book.crossed ? '15ch' : numCol;
  const gridTemplateColumns = [
    'minmax(0, 1fr)',
    options.showDelta ? numCol : null,
    options.showSize ? sizeCol : null,
    options.showSum ? numCol : null,
  ]
    .filter(Boolean)
    .join(' ');

  const barInset = Math.max(0, options.barGap) / 2;
  const anchor = options.barAlign === BarAlign.Right ? styles.barRight : styles.barLeft;

  const renderRow = (level: OrderBookLevel) => {
    const sectionColor = level.side === 'ask' ? askColor : bidColor;

    // Crossed (auction) level: stack the sell bar on top of the buy bar and show both sizes.
    if (level.crossed) {
      return (
        <div key={`x-${level.price}`} className={styles.row}>
          <div
            className={cx(styles.bar, anchor)}
            style={{
              width: `${scale(level.askSize, book.maxSize)}%`,
              top: barInset,
              bottom: `calc(50% + ${barInset}px)`,
              backgroundColor: colorManipulator.alpha(askColor, 0.42),
            }}
          />
          <div
            className={cx(styles.bar, anchor)}
            style={{
              width: `${scale(level.bidSize, book.maxSize)}%`,
              top: `calc(50% + ${barInset}px)`,
              bottom: barInset,
              backgroundColor: colorManipulator.alpha(bidColor, 0.42),
            }}
          />
          <div className={styles.cells} style={{ gridTemplateColumns }}>
            <span className={styles.price} style={{ color: theme.colors.text.primary }}>
              {level.displayPrice}
            </span>
            {options.showDelta && (
              <span className={styles.delta} style={{ color: sectionColor }}>
                {level.delta !== 0 ? formatSigned(level.delta) : ''}
              </span>
            )}
            {options.showSize && (
              <span className={styles.size}>
                <span style={{ color: bidColor }}>{level.displayBidSize}</span>
                <span className={styles.sizeSep}>/</span>
                <span style={{ color: askColor }}>{level.displayAskSize}</span>
              </span>
            )}
            {options.showSum && (
              <span className={styles.sum} style={{ color: colorManipulator.alpha(sectionColor, 0.85) }}>
                {level.displaySum}
              </span>
            )}
          </div>
        </div>
      );
    }

    const color = level.askSize > 0 ? askColor : bidColor;
    const size = level.askSize > 0 ? level.askSize : level.bidSize;
    const depthWidth = options.showDepth ? scale(level.sum, book.maxSum) : 0;
    const sizeWidth = scale(size, book.maxSize);

    return (
      <div key={`${level.side}-${level.price}`} className={styles.row}>
        {options.showDepth && (
          <div
            className={cx(styles.bar, anchor)}
            style={{
              width: `${depthWidth}%`,
              top: barInset,
              bottom: barInset,
              backgroundColor: colorManipulator.alpha(color, 0.16),
            }}
          />
        )}
        <div
          className={cx(styles.bar, anchor)}
          style={{
            width: `${sizeWidth}%`,
            top: barInset,
            bottom: barInset,
            backgroundColor: colorManipulator.alpha(color, 0.42),
          }}
        />
        <div className={styles.cells} style={{ gridTemplateColumns }}>
          <span className={styles.price} style={{ color }}>
            {level.displayPrice}
          </span>
          {options.showDelta && (
            <span className={styles.delta} style={{ color }}>
              {level.delta !== 0 ? formatSigned(level.delta) : ''}
            </span>
          )}
          {options.showSize && <span className={styles.size}>{level.displaySize}</span>}
          {options.showSum && (
            <span className={styles.sum} style={{ color: colorManipulator.alpha(color, 0.85) }}>
              {level.displaySum}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container} style={{ width, height }}>
      <div className={styles.book} ref={scrollRef}>
        <div className={styles.header} style={{ gridTemplateColumns }}>
          <span className={styles.price}>{t('orderbook.col-price', 'PRICE')}</span>
          {options.showDelta && <span className={styles.delta}>{t('orderbook.col-delta', 'DELTA')}</span>}
          {options.showSize && (
            <span className={styles.size}>
              {book.crossed ? t('orderbook.col-buy-sell', 'BUY / SELL') : t('orderbook.col-size', 'SIZE')}
            </span>
          )}
          {options.showSum && <span className={styles.sum}>{t('orderbook.col-sum', 'SUM')}</span>}
        </div>

        <div className={styles.side}>{book.asks.map((l) => renderRow(l))}</div>

        {options.showMidPrice && book.displayMidPrice && (
          <div className={styles.mid} ref={midRef}>
            <span className={styles.midDiamond}>◆</span>
            <span className={styles.midPrice}>{book.displayMidPrice}</span>
          </div>
        )}

        <div className={styles.side}>{book.bids.map((l) => renderRow(l))}</div>
      </div>
    </div>
  );
}

function formatSigned(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  header: css({
    position: 'sticky',
    top: 0,
    zIndex: 2,
    display: 'grid',
    gap: theme.spacing(1),
    padding: theme.spacing(0.25, 1),
    background: theme.colors.background.primary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.xs,
    letterSpacing: '0.04em',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  book: css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    // Reserve the scrollbar gutter so the sticky header and the rows keep their columns aligned.
    scrollbarGutter: 'stable',
  }),
  side: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  row: css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minHeight: 18,
    lineHeight: '18px',
  }),
  bar: css({
    position: 'absolute',
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
  }),
  barLeft: css({
    left: 0,
  }),
  barRight: css({
    right: 0,
  }),
  cells: css({
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0, 1),
    whiteSpace: 'nowrap',
  }),
  price: css({
    textAlign: 'left',
    fontWeight: theme.typography.fontWeightMedium,
  }),
  delta: css({
    textAlign: 'right',
    color: theme.colors.text.secondary,
  }),
  size: css({
    textAlign: 'right',
    color: theme.colors.text.primary,
  }),
  sizeSep: css({
    color: theme.colors.text.secondary,
    margin: theme.spacing(0, 0.5),
  }),
  sum: css({
    textAlign: 'right',
    color: theme.colors.text.secondary,
  }),
  mid: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    borderTop: `1px solid ${theme.colors.border.medium}`,
    borderBottom: `1px solid ${theme.colors.border.medium}`,
    background: theme.colors.background.secondary,
    fontWeight: theme.typography.fontWeightBold,
  }),
  midDiamond: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.xs,
  }),
  midPrice: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
  }),
  empty: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(2),
    color: theme.colors.text.secondary,
  }),
});
