import { __awaiter } from "tslib";
import { fieldExtractors } from './fieldExtractors';
import { FieldExtractorID } from './types';
describe('Extract fields from text', () => {
    it('JSON extractor', () => __awaiter(void 0, void 0, void 0, function* () {
        const extractor = fieldExtractors.get(FieldExtractorID.JSON);
        const out = extractor.parse('{"a":"148.1672","av":41923755,"c":148.25}');
        expect(out).toMatchInlineSnapshot(`
      {
        "a": "148.1672",
        "av": 41923755,
        "c": 148.25,
      }
    `);
    }));
    it('Test key-values with single/double quotes', () => __awaiter(void 0, void 0, void 0, function* () {
        const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
        const out = extractor.parse('a="1",   "b"=\'2\',c=3  x:y ;\r\nz="d and 4"');
        expect(out).toMatchInlineSnapshot(`
      {
        "a": "1",
        "b": "2",
        "c": "3",
        "x": "y",
        "z": "d and 4",
      }
    `);
    }));
    it('Test key-values with nested single/double quotes', () => __awaiter(void 0, void 0, void 0, function* () {
        const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
        const out = extractor.parse(`a="1",   "b"=\'2\',c=3  x:y ;\r\nz="dbl_quotes=\\"Double Quotes\\" sgl_quotes='Single Quotes'"`);
        expect(out).toMatchInlineSnapshot(`
      {
        "a": "1",
        "b": "2",
        "c": "3",
        "x": "y",
        "z": "dbl_quotes="Double Quotes" sgl_quotes='Single Quotes'",
      }
    `);
    }));
    it('Test key-values with nested separator characters', () => __awaiter(void 0, void 0, void 0, function* () {
        const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
        const out = extractor.parse(`a="1",   "b"=\'2\',c=3  x:y ;\r\nz="This is; testing& validating, 1=:2"`);
        expect(out).toMatchInlineSnapshot(`
      {
        "a": "1",
        "b": "2",
        "c": "3",
        "x": "y",
        "z": "This is; testing& validating, 1=:2",
      }
    `);
    }));
    it('Test key-values where some values are null', () => __awaiter(void 0, void 0, void 0, function* () {
        const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
        const out = extractor.parse(`a=, "b"=\'2\',c=3  x: `);
        expect(out).toMatchInlineSnapshot(`
      {
        "a": "",
        "b": "2",
        "c": "3",
        "x": "",
      }
    `);
    }));
    it('Split key+values', () => __awaiter(void 0, void 0, void 0, function* () {
        const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
        const out = extractor.parse('a="1",   "b"=\'2\',c=3  x:y ;\r\nz="7"');
        expect(out).toMatchInlineSnapshot(`
      {
        "a": "1",
        "b": "2",
        "c": "3",
        "x": "y",
        "z": "7",
      }
    `);
    }));
    it('Split URL style parameters', () => __awaiter(void 0, void 0, void 0, function* () {
        const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
        const out = extractor.parse('a=b&c=d&x=123');
        expect(out).toMatchInlineSnapshot(`
      {
        "a": "b",
        "c": "d",
        "x": "123",
      }
    `);
    }));
    it('Prometheus labels style (not really supported)', () => __awaiter(void 0, void 0, void 0, function* () {
        const extractor = fieldExtractors.get(FieldExtractorID.KeyValues);
        const out = extractor.parse('{foo="bar", baz="42"}');
        expect(out).toMatchInlineSnapshot(`
      {
        "baz": "42",
        "foo": "bar",
      }
    `);
    }));
});
//# sourceMappingURL=fieldExtractor.test.js.map