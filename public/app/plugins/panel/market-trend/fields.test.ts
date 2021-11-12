import { createTheme, toDataFrame } from '@grafana/data';
import { prepareCandlestickFields } from './fields';
import { MarketOptions } from './models.gen';

const theme = createTheme();

describe('Candlestick data', () => {
  const options: MarketOptions = {} as MarketOptions;

  it('require a time field', () => {
    const info = prepareCandlestickFields(
      [
        toDataFrame({
          name: 'hello',
          columns: ['a', 'b', 'c'],
          rows: [
            ['A', 2, 3],
            ['B', 4, 5],
            ['C', 6, 7],
          ],
        }),
      ],
      options,
      theme
    );
    expect(info.warn).toMatchInlineSnapshot(`"Data does not have a time field"`);
  });

  it('will match common names by default', () => {
    const info = prepareCandlestickFields(
      [
        toDataFrame({
          fields: [
            { name: 'time', values: [1] },
            { name: 'a', values: [1] },
            { name: 'min', values: [1] },
            { name: 'MAX', values: [1] },
            { name: 'v', values: [1] },
          ],
        }),
      ],
      options,
      theme
    );
    expect(info.warn).toBeUndefined();
    expect(info.names).toMatchInlineSnapshot(`
      Object {
        "close": "Next open",
        "high": "MAX",
        "low": "min",
        "open": "a",
        "volume": "v",
      }
    `);
  });

  it('will support simple timeseries (poorly)', () => {
    const info = prepareCandlestickFields(
      [
        toDataFrame({
          fields: [
            {
              name: 'time',
              values: [1, 2, 3],
            },
            {
              name: 'value',
              values: [4, 5, 6],
            },
          ],
        }),
      ],
      options,
      theme
    );
    expect(info.open).toBeDefined();
    expect(info.open).toEqual(info.high);
    expect(info.open).toEqual(info.low);
    expect(info.open).not.toEqual(info.close);
    expect(info.names.close).toMatchInlineSnapshot(`"Next open"`);

    // Close should be offset by one and dupliate last point
    expect({ open: info.open!.values.toArray(), close: info.close!.values.toArray() }).toMatchInlineSnapshot(`
      Object {
        "close": Array [
          5,
          6,
          6,
        ],
        "open": Array [
          4,
          5,
          6,
        ],
      }
    `);
  });

  it('will create open from previous close', () => {
    const info = prepareCandlestickFields(
      [
        toDataFrame({
          fields: [
            {
              name: 'time',
              values: [1, 2, 3, 4, 5],
            },
            {
              name: 'close',
              values: [1, 2, 3, 4, 5],
            },
          ],
        }),
      ],
      options,
      theme
    );
    expect(info.open!.values.toArray()).toEqual([1, 1, 2, 3, 4]);
    expect(info.close!.values.toArray()).toEqual([1, 2, 3, 4, 5]);
  });
});
