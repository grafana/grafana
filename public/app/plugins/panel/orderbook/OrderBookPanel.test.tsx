import { render, screen } from '@testing-library/react';
import { uniqueId } from 'lodash';

import {
  dateMath,
  dateTime,
  type EventBus,
  FieldType,
  LoadingState,
  type PanelData,
  type TimeRange,
  toDataFrame,
} from '@grafana/data';

import { OrderBookPanel } from './OrderBookPanel';
import { defaultOptions, type Options } from './types';

function createTimeRange(): TimeRange {
  return {
    from: dateMath.parse('now-6h') || dateTime(),
    to: dateMath.parse('now') || dateTime(),
    raw: { from: 'now-6h', to: 'now' },
  };
}

function buildProps(series: PanelData['series'], options: Partial<Options> = {}) {
  const timeRange = createTimeRange();
  return {
    id: Number(uniqueId()),
    data: { series, state: LoadingState.Done, timeRange },
    options: { ...defaultOptions, ...options },
    transparent: false,
    timeRange,
    timeZone: 'utc',
    title: 'Order book',
    fieldConfig: { defaults: {}, overrides: [] },
    onFieldConfigChange: jest.fn(),
    onOptionsChange: jest.fn(),
    onChangeTimeRange: jest.fn(),
    replaceVariables: jest.fn(),
    renderCounter: 0,
    width: 320,
    height: 480,
    eventBus: {} as EventBus,
  };
}

const book = [
  toDataFrame({
    fields: [
      { name: 'price', type: FieldType.number, values: [101, 102, 100, 99] },
      { name: 'size', type: FieldType.number, values: [5, 3, 4, 6] },
      { name: 'side', type: FieldType.string, values: ['ask', 'ask', 'bid', 'bid'] },
    ],
  }),
];

describe('OrderBookPanel', () => {
  it('shows a message when there is no usable data', () => {
    render(<OrderBookPanel {...buildProps([])} />);
    expect(screen.getByText(/no order book data/i)).toBeInTheDocument();
  });

  it('renders the column headers, price levels and mid price', () => {
    render(<OrderBookPanel {...buildProps(book)} />);

    expect(screen.getByText('PRICE')).toBeInTheDocument();
    expect(screen.getByText('DELTA')).toBeInTheDocument();
    expect(screen.getByText('SIZE')).toBeInTheDocument();
    expect(screen.getByText('SUM')).toBeInTheDocument();

    // Every price level is rendered (101 also appears as the rounded mid marker, hence getAllByText).
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getAllByText('101').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();

    // Mid price marker (diamond) is shown between bids and asks.
    expect(screen.getByText('◆')).toBeInTheDocument();
  });

  it('hides the delta and sum columns when disabled', () => {
    render(<OrderBookPanel {...buildProps(book, { showDelta: false, showSum: false })} />);
    expect(screen.queryByText('DELTA')).not.toBeInTheDocument();
    expect(screen.queryByText('SUM')).not.toBeInTheDocument();
    expect(screen.getByText('SIZE')).toBeInTheDocument();
  });

  it('renders a crossed (auction) book with a BUY / SELL column and both sizes', () => {
    const crossed = [
      toDataFrame({
        fields: [
          { name: 'price', type: FieldType.number, values: [101, 100, 100, 99] },
          { name: 'size', type: FieldType.number, values: [5, 4, 7, 6] },
          { name: 'side', type: FieldType.string, values: ['ask', 'ask', 'bid', 'bid'] },
        ],
      }),
    ];
    render(<OrderBookPanel {...buildProps(crossed)} />);

    // Header switches to BUY / SELL when the book is crossed.
    expect(screen.getByText('BUY / SELL')).toBeInTheDocument();
    expect(screen.queryByText('SIZE')).not.toBeInTheDocument();

    // The crossed level at 100 shows both its buy size (7) and sell size (4).
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('hides the size column when disabled', () => {
    render(<OrderBookPanel {...buildProps(book, { showSize: false })} />);
    expect(screen.queryByText('SIZE')).not.toBeInTheDocument();
    // Size 3 (ask 102) is unique to the size column (sums are 8/5/4/10), so it disappears.
    expect(screen.queryByText('3')).not.toBeInTheDocument();
    expect(screen.getByText('SUM')).toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();
  });
});
