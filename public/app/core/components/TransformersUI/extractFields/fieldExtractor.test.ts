import { fieldExtractors, FieldExtractorID } from './fieldExtractors';

describe('Extract fields from text', () => {
  it('JSON extractor', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.JSON);
    const out = extractor.parse('{"a":"148.1672","av":41923755,"c":148.25}');

    expect(out).toMatchInlineSnapshot(`
      Object {
        "a": "148.1672",
        "av": 41923755,
        "c": 148.25,
      }
    `);
  });

  it('Split key+values', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.parse('a="1",   "b"=\'2\',c=3  x:y ;\r\nz="7"');
    expect(out).toMatchInlineSnapshot(`
      Object {
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
    const out = extractor.parse('a=b&c=d&x=123');
    expect(out).toMatchInlineSnapshot(`
      Object {
        "a": "b",
        "c": "d",
        "x": "123",
      }
    `);
  });

  it('Prometheus labels style (not really supported)', async () => {
    const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
    const out = extractor.parse('{foo="bar", baz="42"}');
    expect(out).toMatchInlineSnapshot(`
      Object {
        "baz": "42",
        "foo": "bar",
      }
    `);
  });
});
