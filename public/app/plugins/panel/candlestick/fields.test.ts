import { createTheme, toDataFrame } from '@grafana/data';

import { prepareCandlestickFields } from './fields';
import { CandlestickOptions, VizDisplayMode } from './models.gen';

const theme = createTheme();

describe('Candlestick data', () => {
  const options: CandlestickOptions = {} as CandlestickOptions;

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
    expect(info).toBeNull();
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
    expect(info?.names).toMatchInlineSnapshot(`
      {
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
    )!;

    expect(info.open).toBeDefined();
    expect(info.open).toEqual(info.high);
    expect(info.open).toEqual(info.low);
    expect(info.open).not.toEqual(info.close);
    expect(info.names.close).toMatchInlineSnapshot(`"Next open"`);

    // Close should be offset by one and dupliate last point
    expect({ open: info.open!.values, close: info.close!.values }).toMatchInlineSnapshot(`
      {
        "close": [
          5,
          6,
          6,
        ],
        "open": [
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
    )!;

    expect(info.open!.values).toEqual([1, 1, 2, 3, 4]);
    expect(info.close!.values).toEqual([1, 2, 3, 4, 5]);
  });

  it('will unmap high & low fields in volume-only mode', () => {
    const options: CandlestickOptions = {
      mode: VizDisplayMode.Volume,
      includeAllFields: true,
    } as CandlestickOptions;

    const info = prepareCandlestickFields(
      [
        toDataFrame({
          fields: [
            {
              name: 'time',
              values: [1, 2, 3],
            },
            {
              name: 'low',
              values: [4, 5, 6],
            },
            {
              name: 'high',
              values: [7, 8, 9],
            },
            {
              name: 'open',
              values: [4, 5, 6],
            },
            {
              name: 'close',
              values: [7, 8, 9],
            },
            {
              name: 'volume',
              values: [70, 80, 90],
            },
            {
              name: 'extra',
              values: [10, 20, 30],
            },
          ],
        }),
      ],
      options,
      theme
    )!;

    expect(info.open).toBeDefined();
    expect(info.close).toBeDefined();
    expect(info.volume).toBeDefined();

    expect(info.frame.fields).toContain(info.open);
    expect(info.frame.fields).toContain(info.close);
    expect(info.frame.fields).toContain(info.volume);

    expect(info.high).toBeUndefined();
    expect(info.low).toBeUndefined();

    // includeAllFields: true
    expect(info.frame.fields.find((f) => f.name === 'high')).toBeDefined();
    expect(info.frame.fields.find((f) => f.name === 'low')).toBeDefined();
    expect(info.frame.fields.find((f) => f.name === 'extra')).toBeDefined();
  });

  it('will unmap volume field in candles-only mode', () => {
    const options: CandlestickOptions = {
      mode: VizDisplayMode.Candles,
      includeAllFields: false,
    } as CandlestickOptions;

    const info = prepareCandlestickFields(
      [
        toDataFrame({
          fields: [
            {
              name: 'time',
              values: [1, 2, 3],
            },
            {
              name: 'low',
              values: [4, 5, 6],
            },
            {
              name: 'high',
              values: [7, 8, 9],
            },
            {
              name: 'open',
              values: [4, 5, 6],
            },
            {
              name: 'close',
              values: [7, 8, 9],
            },
            {
              name: 'volume',
              values: [70, 80, 90],
            },
            {
              name: 'extra',
              values: [10, 20, 30],
            },
          ],
        }),
      ],
      options,
      theme
    )!;

    expect(info.open).toBeDefined();
    expect(info.close).toBeDefined();
    expect(info.high).toBeDefined();
    expect(info.low).toBeDefined();

    expect(info.volume).toBeUndefined();

    expect(info.frame.fields).toContain(info.open);
    expect(info.frame.fields).toContain(info.close);
    expect(info.frame.fields).toContain(info.high);
    expect(info.frame.fields).toContain(info.low);

    // includeAllFields: false
    expect(info.frame.fields.find((f) => f.name === 'volume')).toBeUndefined();
    expect(info.frame.fields.find((f) => f.name === 'extra')).toBeUndefined();
  });

  it("will not remove open field from frame when it's also mapped to high in volume-only mode", () => {
    const options: CandlestickOptions = {
      mode: VizDisplayMode.Volume,
      includeAllFields: false,
    } as CandlestickOptions;

    const info = prepareCandlestickFields(
      [
        toDataFrame({
          fields: [
            {
              name: 'time',
              values: [1, 2, 3],
            },
            {
              name: 'open',
              values: [4, 5, 6],
            },
            {
              name: 'close',
              values: [7, 8, 9],
            },
            {
              name: 'volume',
              values: [70, 80, 90],
            },
            {
              name: 'extra',
              values: [10, 20, 30],
            },
          ],
        }),
      ],
      options,
      theme
    )!;

    expect(info.open).toBeDefined();
    expect(info.close).toBeDefined();
    expect(info.volume).toBeDefined();

    expect(info.frame.fields).toContain(info.open);
    expect(info.frame.fields).toContain(info.close);
    expect(info.frame.fields).toContain(info.volume);

    // includeAllFields: false
    expect(info.frame.fields.find((f) => f.name === 'extra')).toBeUndefined();
  });
});
