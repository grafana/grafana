import { FieldType, toDataFrame } from '@grafana/data';
import { config } from '@grafana/runtime';

import { addExtractedFields } from './extractFields';
import { fieldExtractors } from './fieldExtractors';
import { ExtractFieldsOptions, FieldExtractorID } from './types';

describe('Extract fields from text', () => {
  it('JSON extractor', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.JSON);
    const out = extractor.getParser({})('{"a":"148.1672","av":41923755,"c":148.25}');

    expect(out).toMatchInlineSnapshot(`
      {
        "a": "148.1672",
        "av": 41923755,
        "c": 148.25,
      }
    `);
  });

  it('Test key-values with single/double quotes', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.getParser({})('a="1",   "b"=\'2\',c=3  x:y ;\r\nz="d and 4"');
    expect(out).toMatchInlineSnapshot(`
      {
        "a": "1",
        "b": "2",
        "c": "3",
        "x": "y",
        "z": "d and 4",
      }
    `);
  });

  it('Test key-values with nested single/double quotes', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.getParser({})(
      `a="1",   "b"=\'2\',c=3  x:y ;\r\nz="dbl_quotes=\\"Double Quotes\\" sgl_quotes='Single Quotes'"`
    );

    expect(out).toMatchInlineSnapshot(`
      {
        "a": "1",
        "b": "2",
        "c": "3",
        "x": "y",
        "z": "dbl_quotes="Double Quotes" sgl_quotes='Single Quotes'",
      }
    `);
  });

  it('Test key-values with nested separator characters', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.getParser({})(`a="1",   "b"=\'2\',c=3  x:y ;\r\nz="This is; testing& validating, 1=:2"`);

    expect(out).toMatchInlineSnapshot(`
      {
        "a": "1",
        "b": "2",
        "c": "3",
        "x": "y",
        "z": "This is; testing& validating, 1=:2",
      }
    `);
  });

  it('Test key-values where some values are null', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.getParser({})(`a=, "b"=\'2\',c=3  x: `);

    expect(out).toMatchInlineSnapshot(`
      {
        "a": "",
        "b": "2",
        "c": "3",
        "x": "",
      }
    `);
  });

  it('Split key+values', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.getParser({})('a="1",   "b"=\'2\',c=3  x:y ;\r\nz="7"');
    expect(out).toMatchInlineSnapshot(`
      {
        "a": "1",
        "b": "2",
        "c": "3",
        "x": "y",
        "z": "7",
      }
    `);
  });

  it('Split URL style parameters', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.getParser({})('a=b&c=d&x=123');
    expect(out).toMatchInlineSnapshot(`
      {
        "a": "b",
        "c": "d",
        "x": "123",
      }
    `);
  });

  it('Prometheus labels style (not really supported)', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.getParser({})('{foo="bar", baz="42"}');
    expect(out).toMatchInlineSnapshot(`
      {
        "baz": "42",
        "foo": "bar",
      }
    `);
  });

  it('deduplicates names', async () => {
    const frame = toDataFrame({
      fields: [{ name: 'foo', type: FieldType.string, values: ['{"foo":"extracedValue1"}'] }],
    });
    config.featureToggles.extractFieldsNameDeduplication = true;
    const newFrame = addExtractedFields(frame, { format: FieldExtractorID.JSON, source: 'foo' });
    config.featureToggles.extractFieldsNameDeduplication = false;
    expect(newFrame.fields.length).toBe(2);
    expect(newFrame.fields[1].name).toBe('foo 1');
  });

  it('keeps correct names when deduplication is active', async () => {
    const frame = toDataFrame({
      fields: [{ name: 'foo', type: FieldType.string, values: ['{"bar":"extracedValue1"}'] }],
    });
    config.featureToggles.extractFieldsNameDeduplication = true;
    const newFrame = addExtractedFields(frame, { format: FieldExtractorID.JSON, source: 'foo' });
    config.featureToggles.extractFieldsNameDeduplication = false;
    expect(newFrame.fields.length).toBe(2);
    expect(newFrame.fields[1].name).toBe('bar');
  });

  it('splits by regexp', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.RegExp);
    const opts: ExtractFieldsOptions = { regExp: '/^(?<FieldA>\\w+)[^\\w]+(?<FieldB>\\w+)$/' };
    const parse = extractor.getParser(opts);
    const out = parse('abc - re30z');

    expect(out).toMatchInlineSnapshot(`
      {
        "FieldA": "abc",
        "FieldB": "re30z",
      }
    `);
  });

  describe('Delimiter', () => {
    it('splits by comma', async () => {
      const extractor = fieldExtractors.get(FieldExtractorID.Delimiter);
      const parse = extractor.getParser({});
      const out = parse('a,b,c');

      expect(out).toMatchInlineSnapshot(`
        {
          "a": 1,
          "b": 1,
          "c": 1,
        }
      `);
    });

    it('trims whitespace', async () => {
      const extractor = fieldExtractors.get(FieldExtractorID.Delimiter);
      const parse = extractor.getParser({});
      const out = parse(` a, b,c, d `);

      expect(out).toMatchInlineSnapshot(`
        {
          "a": 1,
          "b": 1,
          "c": 1,
          "d": 1,
        }
      `);
    });
  });
});
