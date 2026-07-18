import { FieldType, type DataFrameJSON } from '@grafana/data';

import { randomizeNumber, randomizeString, redactFrame, redactValueDeep } from './redactValues';

describe('randomizeString', () => {
  it('preserves length and changes content', () => {
    const input = 'sensitive-customer-value';
    const output = randomizeString(input);
    expect(output).toHaveLength(input.length);
    expect(output).not.toBe(input);
    expect(output).toMatch(/^[a-z0-9]+$/);
  });

  it('handles the empty string', () => {
    expect(randomizeString('')).toBe('');
  });
});

describe('randomizeNumber', () => {
  it('preserves sign and order of magnitude', () => {
    for (const input of [123.45, -987, 0.005, -0.5, 1e9]) {
      const output = randomizeNumber(input);
      expect(Math.sign(output)).toBe(Math.sign(input));
      expect(Math.floor(Math.log10(Math.abs(output)))).toBe(Math.floor(Math.log10(Math.abs(input))));
    }
  });

  it('passes through zero and non-finite values', () => {
    expect(randomizeNumber(0)).toBe(0);
    expect(randomizeNumber(NaN)).toBeNaN();
    expect(randomizeNumber(Infinity)).toBe(Infinity);
    expect(randomizeNumber(-Infinity)).toBe(-Infinity);
  });
});

describe('redactValueDeep', () => {
  it('redacts strings and numbers, keeps booleans and nulls, walks arrays and objects', () => {
    const input = {
      name: 'customer-pod',
      count: 42,
      active: true,
      missing: null,
      nested: { ips: ['10.0.0.1', '10.0.0.2'] },
    };
    const output = redactValueDeep(input) as typeof input;

    expect(output.name).toHaveLength('customer-pod'.length);
    expect(output.name).not.toBe('customer-pod');
    expect(output.count).not.toBe(42);
    expect(output.active).toBe(true);
    expect(output.missing).toBeNull();
    expect(output.nested.ips).toHaveLength(2);
    expect(output.nested.ips[0]).not.toBe('10.0.0.1');
    // input untouched
    expect(input.nested.ips[0]).toBe('10.0.0.1');
  });
});

describe('redactFrame', () => {
  const frame: DataFrameJSON = {
    schema: {
      refId: 'A',
      meta: { executedQueryString: 'SELECT secret FROM customers' },
      fields: [
        { name: 'Time', type: FieldType.time },
        { name: 'value', type: FieldType.number, labels: { pod: 'checkout-7f9' } },
        { name: 'host', type: FieldType.string },
        { name: 'up', type: FieldType.boolean },
        { name: 'level', type: FieldType.enum },
        { name: 'blob' },
      ],
    },
    data: {
      values: [
        [1000, 2000, 3000],
        [1.5, null, 300],
        ['host-a', 'host-b', null],
        [true, false, true],
        [0, 1, 0],
        [{ customer: 'acme' }, 'raw-string', null],
      ],
      entities: [null, { NaN: [1] }, null, null, null, null],
      enums: [null, null, null, null, ['error', 'warn'], null],
      bases: [0, 100, 0, 0, 0, 0],
    },
  };

  it('redacts by field type and preserves structure', () => {
    const output = redactFrame(frame);

    // time and boolean untouched
    expect(output.data!.values[0]).toEqual([1000, 2000, 3000]);
    expect(output.data!.values[3]).toEqual([true, false, true]);

    // numbers randomized, nulls preserved
    expect(output.data!.values[1]).toHaveLength(3);
    expect(output.data!.values[1][0]).not.toBe(1.5);
    expect(output.data!.values[1][1]).toBeNull();

    // strings randomized with length preserved
    expect(output.data!.values[2][0]).toHaveLength('host-a'.length);
    expect(output.data!.values[2][0]).not.toBe('host-a');
    expect(output.data!.values[2][2]).toBeNull();

    // enum codes untouched, dictionary randomized
    expect(output.data!.values[4]).toEqual([0, 1, 0]);
    expect(output.data!.enums![4]).toHaveLength(2);
    expect(output.data!.enums![4]![0]).not.toBe('error');

    // missing type fails closed via deep redaction
    const blob = output.data!.values[5][0] as { customer: string };
    expect(blob.customer).not.toBe('acme');
    expect(output.data!.values[5][2]).toBeNull();
  });

  it('redacts label values but keeps keys and field names', () => {
    const output = redactFrame(frame);
    const valueField = output.schema!.fields[1];
    expect(valueField.name).toBe('value');
    expect(Object.keys(valueField.labels!)).toEqual(['pod']);
    expect(valueField.labels!.pod).not.toBe('checkout-7f9');
  });

  it('redacts executedQueryString and passes through entities and bases', () => {
    const output = redactFrame(frame);
    expect(output.schema!.meta!.executedQueryString).not.toBe('SELECT secret FROM customers');
    expect(output.data!.entities).toBe(frame.data!.entities);
    expect(output.data!.bases).toBe(frame.data!.bases);
  });

  it('does not mutate the input frame', () => {
    const before = JSON.parse(JSON.stringify(frame));
    redactFrame(frame);
    expect(frame).toEqual(before);
  });

  it('handles frames without schema or data', () => {
    expect(redactFrame({})).toEqual({});
    expect(redactFrame({ schema: { fields: [] } })).toEqual({ schema: { fields: [] } });
  });
});
