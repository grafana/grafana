import { createTheme, FieldType, toDataFrame } from '@grafana/data';

import { defaultOptions, MidPriceSource } from './types';
import { prepareOrderBook, snapshotSizes } from './utils';

const theme = createTheme();

function frameWithSide() {
  return [
    toDataFrame({
      fields: [
        { name: 'price', type: FieldType.number, values: [101, 102, 100, 99] },
        { name: 'size', type: FieldType.number, values: [5, 3, 4, 6] },
        { name: 'side', type: FieldType.string, values: ['ask', 'ask', 'bid', 'bid'] },
      ],
    }),
  ];
}

describe('prepareOrderBook', () => {
  it('returns null when there is no data', () => {
    expect(prepareOrderBook([], defaultOptions, theme)).toBeNull();
    expect(prepareOrderBook(undefined, defaultOptions, theme)).toBeNull();
  });

  it('returns null without a price and size field', () => {
    const frames = [toDataFrame({ fields: [{ name: 'price', type: FieldType.number, values: [1, 2] }] })];
    expect(prepareOrderBook(frames, defaultOptions, theme)).toBeNull();
  });

  it('splits levels by an explicit side field', () => {
    const book = prepareOrderBook(frameWithSide(), defaultOptions, theme)!;
    expect(book).not.toBeNull();
    expect(book.asks.map((l) => l.price)).toEqual([102, 101]); // highest ask first
    expect(book.bids.map((l) => l.price)).toEqual([100, 99]); // best bid first
  });

  it('accumulates the cumulative sum from the mid price outward', () => {
    const book = prepareOrderBook(frameWithSide(), defaultOptions, theme)!;
    // asks displayed top-to-bottom are [102, 101]; best ask (101) sums first.
    const ask101 = book.asks.find((l) => l.price === 101)!;
    const ask102 = book.asks.find((l) => l.price === 102)!;
    expect(ask101.sum).toBe(5);
    expect(ask102.sum).toBe(8);
    // bids: best bid (100) first, then 99.
    const bid100 = book.bids.find((l) => l.price === 100)!;
    const bid99 = book.bids.find((l) => l.price === 99)!;
    expect(bid100.sum).toBe(4);
    expect(bid99.sum).toBe(10);
    expect(book.maxSum).toBe(10);
    expect(book.maxSize).toBe(6);
  });

  it('computes the mid price as the midpoint of best bid and best ask', () => {
    const book = prepareOrderBook(frameWithSide(), defaultOptions, theme)!;
    expect(book.midPrice).toBe((101 + 100) / 2);
  });

  it('is not crossed for a normal book', () => {
    expect(prepareOrderBook(frameWithSide(), defaultOptions, theme)!.crossed).toBe(false);
  });

  it('aggregates a crossed (auction) level carrying both buy and sell size', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'price', type: FieldType.number, values: [101, 100, 100, 99] },
          { name: 'size', type: FieldType.number, values: [5, 4, 7, 6] },
          { name: 'side', type: FieldType.string, values: ['ask', 'ask', 'bid', 'bid'] },
        ],
      }),
    ];
    const book = prepareOrderBook(frames, defaultOptions, theme)!;
    expect(book.crossed).toBe(true);

    const level = [...book.asks, ...book.bids].find((l) => l.price === 100)!;
    expect(level.crossed).toBe(true);
    expect(level.bidSize).toBe(7); // buy size
    expect(level.askSize).toBe(4); // sell size
    expect(level.displayBidSize).toBe('7');
    expect(level.displayAskSize).toBe('4');
  });

  it('sums sizes reported at the same price and side', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'price', type: FieldType.number, values: [101, 101, 100] },
          { name: 'size', type: FieldType.number, values: [5, 3, 4] },
          { name: 'side', type: FieldType.string, values: ['ask', 'ask', 'bid'] },
        ],
      }),
    ];
    const book = prepareOrderBook(frames, defaultOptions, theme)!;
    const ask101 = book.asks.find((l) => l.price === 101)!;
    expect(ask101.askSize).toBe(8); // 5 + 3
    expect(ask101.crossed).toBe(false);
  });

  it('splits by the median price when no side field is present', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'price', type: FieldType.number, values: [98, 99, 101, 102] },
          { name: 'size', type: FieldType.number, values: [1, 2, 3, 4] },
        ],
      }),
    ];
    const book = prepareOrderBook(frames, defaultOptions, theme)!;
    // median of [98,99,101,102] = 100; above -> asks, at/below -> bids.
    expect(book.asks.map((l) => l.price).sort()).toEqual([101, 102]);
    expect(book.bids.map((l) => l.price).sort()).toEqual([98, 99]);
  });

  it('computes the delta versus the previous snapshot', () => {
    const first = prepareOrderBook(frameWithSide(), defaultOptions, theme)!;
    // First render has no baseline -> all deltas 0.
    expect(first.asks.every((l) => l.delta === 0)).toBe(true);

    const prev = snapshotSizes(first);
    const updated = [
      toDataFrame({
        fields: [
          { name: 'price', type: FieldType.number, values: [101, 102, 100, 99] },
          { name: 'size', type: FieldType.number, values: [8, 3, 4, 1] },
          { name: 'side', type: FieldType.string, values: ['ask', 'ask', 'bid', 'bid'] },
        ],
      }),
    ];
    const second = prepareOrderBook(updated, defaultOptions, theme, prev)!;
    expect(second.asks.find((l) => l.price === 101)!.delta).toBe(3); // 8 - 5
    expect(second.bids.find((l) => l.price === 99)!.delta).toBe(-5); // 1 - 6
  });

  it('limits the number of levels per side, keeping those nearest the mid', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'price', type: FieldType.number, values: [103, 102, 101, 100, 99, 98] },
          { name: 'size', type: FieldType.number, values: [1, 1, 1, 1, 1, 1] },
          { name: 'side', type: FieldType.string, values: ['ask', 'ask', 'ask', 'bid', 'bid', 'bid'] },
        ],
      }),
    ];
    const book = prepareOrderBook(frames, { ...defaultOptions, maxLevels: 2 }, theme)!;
    expect(book.asks.map((l) => l.price)).toEqual([102, 101]); // nearest the mid
    expect(book.bids.map((l) => l.price)).toEqual([100, 99]);
  });

  it('reads the mid price from a field when configured', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'price', type: FieldType.number, values: [101, 100] },
          { name: 'size', type: FieldType.number, values: [5, 4] },
          { name: 'side', type: FieldType.string, values: ['ask', 'bid'] },
          { name: 'mid', type: FieldType.number, values: [100.25, 100.25] },
        ],
      }),
    ];
    const book = prepareOrderBook(
      frames,
      { ...defaultOptions, midPriceSource: MidPriceSource.Field, midPriceField: 'mid' },
      theme
    )!;
    expect(book.midPrice).toBe(100.25);
  });
});
