import {
  type DataFrame,
  type Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  type GrafanaTheme2,
} from '@grafana/data';

import { MidPriceSource, type Options } from './types';

export type Side = 'bid' | 'ask';

export interface OrderBookLevel {
  price: number;
  /** Buy (bid) size at this price; 0 when there is no buy interest. */
  bidSize: number;
  /** Sell (ask) size at this price; 0 when there is no sell interest. */
  askSize: number;
  /** True when the level has both buy and sell size (a crossed/auction level). */
  crossed: boolean;
  /** Section the level is displayed in, relative to the mid price (top = ask, bottom = bid). */
  side: Side;
  /** Cumulative size on the displayed side, accumulated from the mid price outward. */
  sum: number;
  /** Change in the displayed side's size versus the previous update (0 when the level is new). */
  delta: number;
  displayPrice: string;
  displayBidSize: string;
  displayAskSize: string;
  /** The displayed side's size, formatted (used for non-crossed levels). */
  displaySize: string;
  displaySum: string;
}

export interface OrderBook {
  /** Ask-section levels (price >= mid), ordered top-to-bottom (highest price first). */
  asks: OrderBookLevel[];
  /** Bid-section levels (price < mid), ordered top-to-bottom (best bid first). */
  bids: OrderBookLevel[];
  /** True during an auction when bids and asks overlap (some price has both buy and sell size). */
  crossed: boolean;
  midPrice?: number;
  displayMidPrice?: string;
  /** Largest single-level size across both sides — used to scale the size bar. */
  maxSize: number;
  /** Largest cumulative sum across both sides — used to scale the depth bar. */
  maxSum: number;
}

/** Buy/sell sizes by price from the previous update, used to compute the delta column. */
export interface SizeSnapshot {
  bid: Map<number, number>;
  ask: Map<number, number>;
}

const PRICE_RE = /price|bid|ask|level/i;
const SIZE_RE = /size|volume|qty|quantity|amount|liquidity/i;
const SIDE_RE = /side|type|direction/i;

function findField(frame: DataFrame, explicit: string | undefined, type: FieldType, re: RegExp): Field | undefined {
  if (explicit) {
    return frame.fields.find((f) => getFieldDisplayName(f, frame) === explicit || f.name === explicit);
  }
  // Prefer a field whose name matches the regex; fall back to the first field of the right type.
  const named = frame.fields.find((f) => f.type === type && re.test(f.name));
  if (named) {
    return named;
  }
  return frame.fields.find((f) => f.type === type);
}

function findSideField(frame: DataFrame, explicit: string | undefined): Field | undefined {
  if (explicit) {
    return frame.fields.find((f) => getFieldDisplayName(f, frame) === explicit || f.name === explicit);
  }
  return frame.fields.find((f) => f.type === FieldType.string && SIDE_RE.test(f.name));
}

function normalizeSide(value: unknown): Side | undefined {
  if (typeof value === 'number') {
    return value >= 0 ? 'bid' : 'ask';
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'bid' || v === 'buy' || v === 'b') {
      return 'bid';
    }
    if (v === 'ask' || v === 'sell' || v === 'offer' || v === 's' || v === 'a') {
      return 'ask';
    }
  }
  return undefined;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function readMidPriceField(frame: DataFrame, fieldName: string): number | undefined {
  const mf = frame.fields.find((f) => getFieldDisplayName(f, frame) === fieldName || f.name === fieldName);
  const v = mf?.values.find((x) => typeof x === 'number' && Number.isFinite(x));
  return typeof v === 'number' ? v : undefined;
}

/**
 * Build the order book model from the panel's data frames. Sizes are aggregated by price so a single
 * level can carry both buy and sell size — this is what happens during an auction when the book is
 * crossed (bids and asks overlap). Returns `null` when the required price/size fields cannot be found
 * so the panel can render a helpful message instead.
 */
export function prepareOrderBook(
  frames: DataFrame[] | undefined,
  options: Options,
  theme: GrafanaTheme2,
  prevSizes?: SizeSnapshot
): OrderBook | null {
  const frame = frames?.find((f) => f.length > 0);
  if (!frame) {
    return null;
  }

  const priceField = findField(frame, options.priceField, FieldType.number, PRICE_RE);
  const sizeField = findField(frame, options.sizeField, FieldType.number, SIZE_RE);
  if (!priceField || !sizeField || priceField === sizeField) {
    return null;
  }

  const sideField = findSideField(frame, options.sideField);

  // When there is no explicit side, split levels relative to a reference price.
  let splitPrice = Number.NaN;
  if (!sideField) {
    const prices: number[] = [];
    for (let i = 0; i < frame.length; i++) {
      const p = priceField.values[i];
      if (typeof p === 'number' && Number.isFinite(p)) {
        prices.push(p);
      }
    }
    const fieldMid =
      options.midPriceSource === MidPriceSource.Field && options.midPriceField
        ? readMidPriceField(frame, options.midPriceField)
        : undefined;
    splitPrice = fieldMid ?? median(prices);
  }

  // Aggregate buy and sell size by price. A price can appear on both sides during an auction.
  const bidByPrice = new Map<number, number>();
  const askByPrice = new Map<number, number>();
  for (let i = 0; i < frame.length; i++) {
    const price = priceField.values[i];
    const size = sizeField.values[i];
    if (typeof price !== 'number' || !Number.isFinite(price) || typeof size !== 'number' || !Number.isFinite(size)) {
      continue;
    }
    const side = sideField ? normalizeSide(sideField.values[i]) : price > splitPrice ? 'ask' : 'bid';
    if (!side) {
      continue;
    }
    const target = side === 'ask' ? askByPrice : bidByPrice;
    target.set(price, (target.get(price) ?? 0) + size);
  }

  const askPricesAsc = [...askByPrice.keys()].sort((a, b) => a - b);
  const bidPricesDesc = [...bidByPrice.keys()].sort((a, b) => b - a);
  const bestAsk = askPricesAsc[0];
  const bestBid = bidPricesDesc[0];

  let midPrice: number | undefined;
  if (options.midPriceSource === MidPriceSource.Field && options.midPriceField) {
    midPrice = readMidPriceField(frame, options.midPriceField);
  }
  if (midPrice === undefined) {
    midPrice = bestAsk !== undefined && bestBid !== undefined ? (bestAsk + bestBid) / 2 : (bestAsk ?? bestBid);
  }

  // Cumulative sizes accumulate from the best price outward (away from the mid) on each side.
  const askSumByPrice = new Map<number, number>();
  let askRun = 0;
  for (const p of askPricesAsc) {
    askRun += askByPrice.get(p)!;
    askSumByPrice.set(p, askRun);
  }
  const bidSumByPrice = new Map<number, number>();
  let bidRun = 0;
  for (const p of bidPricesDesc) {
    bidRun += bidByPrice.get(p)!;
    bidSumByPrice.set(p, bidRun);
  }

  const priceDisplay = priceField.display ?? getDisplayProcessor({ field: priceField, theme });
  const sizeDisplay = sizeField.display ?? getDisplayProcessor({ field: sizeField, theme });
  const fmtPrice = (v: number) => formattedValueToString(priceDisplay(v));
  const fmtSize = (v: number) => formattedValueToString(sizeDisplay(v));

  let maxSize = 0;
  let maxSum = 0;
  let crossed = false;

  const allPricesDesc = [...new Set([...askByPrice.keys(), ...bidByPrice.keys()])].sort((a, b) => b - a);

  const levels: OrderBookLevel[] = allPricesDesc.map((price) => {
    const bidSize = bidByPrice.get(price) ?? 0;
    const askSize = askByPrice.get(price) ?? 0;
    const isCrossed = bidSize > 0 && askSize > 0;
    if (isCrossed) {
      crossed = true;
    }
    // Section is decided by the mid; the displayed side picks the stream that actually has size.
    const section: Side = midPrice !== undefined && price < midPrice ? 'bid' : 'ask';
    const displaySide: Side = isCrossed ? section : askSize > 0 ? 'ask' : 'bid';
    const sum = (displaySide === 'ask' ? askSumByPrice.get(price) : bidSumByPrice.get(price)) ?? 0;

    const prevBid = prevSizes?.bid.get(price);
    const prevAsk = prevSizes?.ask.get(price);
    const delta =
      displaySide === 'ask'
        ? prevAsk === undefined
          ? 0
          : askSize - prevAsk
        : prevBid === undefined
          ? 0
          : bidSize - prevBid;

    maxSize = Math.max(maxSize, bidSize, askSize);
    maxSum = Math.max(maxSum, askSumByPrice.get(price) ?? 0, bidSumByPrice.get(price) ?? 0);

    return {
      price,
      bidSize,
      askSize,
      crossed: isCrossed,
      side: section,
      sum,
      delta,
      displayPrice: fmtPrice(price),
      displayBidSize: fmtSize(bidSize),
      displayAskSize: fmtSize(askSize),
      displaySize: fmtSize(displaySide === 'ask' ? askSize : bidSize),
      displaySum: fmtSize(sum),
    };
  });

  const limited = (arr: OrderBookLevel[], fromStart: boolean) => {
    if (!options.maxLevels || options.maxLevels <= 0 || arr.length <= options.maxLevels) {
      return arr;
    }
    // Keep the levels closest to the mid price.
    return fromStart ? arr.slice(arr.length - options.maxLevels) : arr.slice(0, options.maxLevels);
  };

  // Split the price-descending ladder at the mid: levels above go in the top (ask) section, the rest below.
  const asks = limited(
    levels.filter((l) => l.side === 'ask'),
    true
  );
  const bids = limited(
    levels.filter((l) => l.side === 'bid'),
    false
  );

  return {
    asks,
    bids,
    crossed,
    midPrice,
    displayMidPrice: midPrice !== undefined ? fmtPrice(midPrice) : undefined,
    maxSize,
    maxSum,
  };
}

/** Snapshot the current buy/sell sizes so the next update can compute deltas. */
export function snapshotSizes(book: OrderBook | null): SizeSnapshot {
  const snapshot: SizeSnapshot = { bid: new Map(), ask: new Map() };
  if (!book) {
    return snapshot;
  }
  for (const l of [...book.asks, ...book.bids]) {
    if (l.bidSize > 0) {
      snapshot.bid.set(l.price, l.bidSize);
    }
    if (l.askSize > 0) {
      snapshot.ask.set(l.price, l.askSize);
    }
  }
  return snapshot;
}
